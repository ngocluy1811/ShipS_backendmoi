from flask import Flask, request, jsonify
from flask_cors import CORS
from geopy.geocoders import Nominatim
import openrouteservice
import time

app = Flask(__name__)
CORS(app)
ORS_API_KEY = '5b3ce3597851110001cf6248e3e8ef34ed2b4788a48fd77f04a52ca1'

def try_geocode(geolocator, address_parts):
    for addr in address_parts:
        loc = geolocator.geocode(addr, timeout=10)
        if loc:
            return loc
        time.sleep(1)
    return None

def clean_name(name):
    if not name:
        return ''
    for prefix in ["Tỉnh ", "Thành phố ", "Huyện ", "Quận ", "Xã ", "Phường ", "Thị trấn "]:
        if name.startswith(prefix):
            return name[len(prefix):]
    return name

@app.route('/api/calc-distance', methods=['POST'])
def calc_distance():
    try:
        data = request.json
        if isinstance(data.get('sender'), dict):
            sender = data['sender']
            receiver = data['receiver']
            sender_parts = [
                f"{clean_name(sender.get('ward', ''))}, {clean_name(sender.get('district', ''))}, {clean_name(sender.get('province', ''))}, Việt Nam",
                f"{clean_name(sender.get('district', ''))}, {clean_name(sender.get('province', ''))}, Việt Nam",
                f"{clean_name(sender.get('province', ''))}, Việt Nam"
            ]
            receiver_parts = [
                f"{clean_name(receiver.get('ward', ''))}, {clean_name(receiver.get('district', ''))}, {clean_name(receiver.get('province', ''))}, Việt Nam",
                f"{clean_name(receiver.get('district', ''))}, {clean_name(receiver.get('province', ''))}, Việt Nam",
                f"{clean_name(receiver.get('province', ''))}, Việt Nam"
            ]
        else:
            sender_parts = [data['sender']]
            receiver_parts = [data['receiver']]

        print('Địa chỉ thử cho sender:', sender_parts)
        print('Địa chỉ thử cho receiver:', receiver_parts)

        geolocator = Nominatim(user_agent="my_shipping_app")
        location_sender = try_geocode(geolocator, sender_parts)
        location_receiver = try_geocode(geolocator, receiver_parts)

        if not location_sender or not location_receiver:
            return jsonify({'error': 'Không tìm thấy tọa độ!'}), 400

        client = openrouteservice.Client(key=ORS_API_KEY)
        coords = [
            [location_sender.longitude, location_sender.latitude],
            [location_receiver.longitude, location_receiver.latitude]
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