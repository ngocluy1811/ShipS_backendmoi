from flask import Flask, request, jsonify
from flask_cors import CORS
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut
import openrouteservice
import time
from geopy.distance import geodesic

app = Flask(__name__)
CORS(app)
ORS_API_KEY = '5b3ce3597851110001cf6248e3e8ef34ed2b4788a48fd77f04a52ca1'
geolocator = Nominatim(user_agent="ships_app", timeout=10)

def try_geocode_variants(addr_variants):
    # Trả về list các location tìm được (ưu tiên từ chi tiết đến tổng quát)
    locs = []
    for addr in addr_variants:
        try:
            print(f"Thử geocode: {addr}")
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

        # Thử tất cả các cặp (ưu tiên chi tiết nhất)
        client = openrouteservice.Client(key=ORS_API_KEY)
        for s in sender_locs:
            for r in receiver_locs:
                # Nếu hai điểm trùng nhau
                if (round(s.latitude, 6) == round(r.latitude, 6) and round(s.longitude, 6) == round(r.longitude, 6)):
                    return jsonify({'distance_km': 0, 'fallback': False})
                try:
                    coords = [
                        [s.longitude, s.latitude],
                        [r.longitude, r.latitude]
                    ]
                    route = client.directions(coordinates=coords, profile='driving-car')
                    if route and 'routes' in route and route['routes']:
                        distance_km = route['routes'][0]['summary']['distance'] / 1000
                        print(f"-> Route thành công với: {s}, {r}")
                        return jsonify({'distance_km': round(distance_km, 2), 'fallback': False})
                except Exception as e:
                    print(f"Lỗi ORS với {s}, {r}: {e}")
                    continue

        # Nếu không tìm được route, fallback sang Haversine
        print('Fallback sang Haversine!')
        s = sender_locs[0]
        r = receiver_locs[0]
        distance_km = geodesic((s.latitude, s.longitude), (r.latitude, r.longitude)).km
        return jsonify({'distance_km': round(distance_km, 2), 'fallback': True})
    except Exception as e:
        print(f"Lỗi server: {e}")
        return jsonify({'error': f'Lỗi server: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(port=5001) 