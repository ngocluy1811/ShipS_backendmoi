from flask import Flask, request, jsonify
from flask_cors import CORS
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut
import openrouteservice
import time

app = Flask(__name__)
CORS(app)
ORS_API_KEY = '5b3ce3597851110001cf6248e3e8ef34ed2b4788a48fd77f04a52ca1'
geolocator = Nominatim(user_agent="ships_app", timeout=10)

def try_geocode(address_list):
    # Thử lần lượt các format địa chỉ từ chi tiết đến tổng quát
    for addr in address_list:
        try:
            print(f"Thử geocode: {addr}")
            location = geolocator.geocode(addr)
            if location:
                print(f"-> Tìm được: {location.latitude}, {location.longitude}")
                return location
        except GeocoderTimedOut:
            continue
        except Exception as e:
            print(f"Lỗi geocoding: {e}")
    return None

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

        sender_location = try_geocode(sender_variants)
        receiver_location = try_geocode(receiver_variants)

        if not sender_location or not receiver_location:
            print("Không tìm được tọa độ cho sender hoặc receiver.")
            return jsonify({'error': 'Không tìm được tọa độ cho địa chỉ gửi hoặc nhận!'}), 400

        client = openrouteservice.Client(key=ORS_API_KEY)
        coords = [
            [sender_location.longitude, sender_location.latitude],
            [receiver_location.longitude, receiver_location.latitude]
        ]
        try:
            route = client.directions(coordinates=coords, profile='driving-car')
            distance_km = route['routes'][0]['summary']['distance'] / 1000
        except Exception as e:
            return jsonify({'error': f'Lỗi OpenRouteService: {str(e)}'}), 400

        return jsonify({'distance_km': round(distance_km, 2)})
    except Exception as e:
        return jsonify({'error': f'Lỗi server: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(port=5001) 