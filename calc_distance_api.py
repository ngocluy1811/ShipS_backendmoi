from flask import Flask, request, jsonify
from flask_cors import CORS
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut
import openrouteservice
import time
from geopy.distance import geodesic
import os
import requests

app = Flask(__name__)
CORS(app)
ORS_API_KEY = '5b3ce3597851110001cf6248e3e8ef34ed2b4788a48fd77f04a52ca1'
VIETMAP_API_KEY = '7f9ef35866466886ebd24ba5091eda803732c8c76cde1b4a'
geolocator = Nominatim(user_agent="ships_app", timeout=10)

def try_geocode_vietmap(addr):
    if not VIETMAP_API_KEY:
        return None
    try:
        url = 'https://maps.vietmap.vn/api/search'
        params = {'apikey': VIETMAP_API_KEY, 'text': addr}
        resp = requests.get(url, params=params, timeout=10)
        print(f"[VietMap] Geocode URL: {resp.url}")
        print(f"[VietMap] Geocode status: {resp.status_code}")
        print(f"[VietMap] Geocode response: {resp.text}")
        data = resp.json()
        if data and 'features' in data and data['features']:
            feat = data['features'][0]
            lon, lat = feat['geometry']['coordinates']
            class Loc:
                pass
            loc = Loc()
            loc.latitude = lat
            loc.longitude = lon
            return loc
    except Exception as e:
        print(f"Lỗi geocode VietMap: {e}")
    return None

def try_geocode_variants(addr_variants):
    # Trả về list các location tìm được (ưu tiên từ chi tiết đến tổng quát)
    locs = []
    for addr in addr_variants:
        # Ưu tiên VietMap
        loc = try_geocode_vietmap(addr)
        if loc:
            print(f"[VietMap] -> Tìm được: {loc.latitude}, {loc.longitude}")
            locs.append(loc)
            continue
        # Fallback sang Nominatim nếu VietMap không trả về
        try:
            print(f"[Nominatim] Thử geocode: {addr}")
            location = geolocator.geocode(addr)
            if location:
                print(f"-> Tìm được: {location.latitude}, {location.longitude}")
                locs.append(location)
        except GeocoderTimedOut:
            continue
        except Exception as e:
            print(f"Lỗi geocoding: {e}")
    return locs

def clean_name(name):
    if not name:
        return ''
    for prefix in ["Tỉnh ", "Thành phố ", "Huyện ", "Quận ", "Xã ", "Phường ", "Thị trấn "]:
        if name.startswith(prefix):
            return name[len(prefix):]
    return name

def build_variants(addr):
    # Tách các phần, loại bỏ lặp Việt Nam
    parts = [p.strip() for p in addr.replace('Việt Nam', '').split(',') if p.strip()]
    variants = []
    # Đầy đủ
    variants.append(', '.join(parts + ['Việt Nam']))
    # Bỏ xã/phường
    if len(parts) > 2:
        variants.append(', '.join(parts[1:] + ['Việt Nam']))
    # Chỉ tỉnh/thành, quận/huyện
    if len(parts) > 1:
        variants.append(', '.join(parts[-2:] + ['Việt Nam']))
    # Chỉ tỉnh/thành
    if len(parts) > 0:
        variants.append(parts[-1] + ', Việt Nam')
    return variants

def get_vietmap_route_distance(lat1, lon1, lat2, lon2):
    try:
        url = "https://maps.vietmap.vn/api/route"
        params = {
            "apikey": VIETMAP_API_KEY,
            "point": [f"{lat1},{lon1}", f"{lat2},{lon2}"],
            "vehicle": "car"
        }
        resp = requests.get(url, params=params, timeout=10)
        print("[VietMap] Route URL:", resp.url)
        print("[VietMap] Route status:", resp.status_code)
        print("[VietMap] Route response:", resp.text)
        data = resp.json()
        if data and 'routes' in data and data['routes']:
            distance_m = data['routes'][0]['summary']['distance']
            return distance_m / 1000  # km
        else:
            print("VietMap route API không trả về route hợp lệ:", data)
            return None
    except Exception as e:
        print(f"Lỗi gọi VietMap route: {e}")
        return None

def get_vietmap_matrix_distance(points):
    """
    Calculate distances between multiple points using VietMap Matrix API
    points: list of (lat, lon) tuples
    returns: list of distances in km
    """
    try:
        url = "https://maps.vietmap.vn/api/matrix"
        params = {
            "api-version": "1.1",
            "apikey": VIETMAP_API_KEY,
            "vehicle": "car",
            "annotation": "distance",
            "points_encoded": "false"
        }
        
        # Add all points
        for lat, lon in points:
            params.setdefault("point", []).append(f"{lat},{lon}")
            
        # Set sources and destinations
        n = len(points)
        params["sources"] = "0"  # First point is source
        params["destinations"] = ";".join(str(i) for i in range(1, n))  # All other points are destinations
        
        print("[VietMap] Matrix URL:", url)
        print("[VietMap] Matrix params:", params)
        
        resp = requests.get(url, params=params, timeout=10)
        print("[VietMap] Matrix status:", resp.status_code)
        print("[VietMap] Matrix response:", resp.text)
        
        if resp.status_code == 200:
            data = resp.json()
            if data and 'distances' in data and data['distances']:
                # Convert distances from meters to kilometers
                distances_km = [d/1000 for d in data['distances'][0]]
                return distances_km
            else:
                print("VietMap matrix API không trả về distances hợp lệ:", data)
                return None
        else:
            print(f"VietMap matrix API error: {resp.status_code}")
            return None
            
    except Exception as e:
        print(f"Lỗi gọi VietMap matrix: {e}")
        return None

@app.route('/api/calc-distance', methods=['POST'])
def calc_distance():
    try:
        data = request.json
        sender = data['sender'][0] if isinstance(data['sender'], list) else data['sender']
        receiver = data['receiver'][0] if isinstance(data['receiver'], list) else data['receiver']

        print('Địa chỉ thử cho sender:', sender)
        print('Địa chỉ thử cho receiver:', receiver)

        sender_variants = build_variants(sender)
        receiver_variants = build_variants(receiver)

        sender_locs = try_geocode_variants(sender_variants)
        receiver_locs = try_geocode_variants(receiver_variants)

        if not sender_locs or not receiver_locs:
            print("Không tìm được tọa độ cho sender hoặc receiver.")
            return jsonify({'error': 'Không tìm được tọa độ cho địa chỉ gửi hoặc nhận!'}), 400

        # Chỉ lấy cặp chi tiết nhất
        s = sender_locs[0]
        r = receiver_locs[0]
        
        # Try Matrix API first
        points = [(s.latitude, s.longitude), (r.latitude, r.longitude)]
        distances = get_vietmap_matrix_distance(points)
        
        if distances and len(distances) > 0:
            distance_km = distances[0]  # First distance is from source to first destination
            return jsonify({'distance_km': round(distance_km, 2), 'fallback': False})
            
        # Fallback to Route API if Matrix fails
        distance_km = get_vietmap_route_distance(s.latitude, s.longitude, r.latitude, r.longitude)
        if distance_km is not None:
            return jsonify({'distance_km': round(distance_km, 2), 'fallback': False})
        else:
            return jsonify({'error': 'Không tìm được route thực tế bằng VietMap!'}), 400
            
    except Exception as e:
        print(f"Lỗi server: {e}")
        return jsonify({'error': f'Lỗi server: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(port=5001) 