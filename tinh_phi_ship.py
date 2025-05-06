# -*- coding: utf-8 -*-
from geopy.geocoders import Nominatim
import openrouteservice

# Thay API key của bạn vào đây
ORS_API_KEY = '5b3ce3597851110001cf6248e3e8ef34ed2b4788a48fd77f04a52ca1'

# Địa chỉ lấy từ form (có thể thay bằng input thực tế)
address_sender = "Xã Yên Vượng, Huyện Hữu Lũng, Tỉnh Lạng Sơn"
address_receiver = "Xã Yến Mao, Huyện Thanh Thuỷ, Tỉnh Phú Thọ"

# Bước 1: Geocoding
geolocator = Nominatim(user_agent="my_shipping_app")
location_sender = geolocator.geocode(address_sender)
location_receiver = geolocator.geocode(address_receiver)

if not location_sender or not location_receiver:
    print("Không tìm thấy tọa độ cho một trong hai địa chỉ!")
    exit()

print("Tọa độ người gửi:", location_sender.latitude, location_sender.longitude)
print("Tọa độ người nhận:", location_receiver.latitude, location_receiver.longitude)

# Bước 2: Tính khoảng cách thực tế
client = openrouteservice.Client(key=ORS_API_KEY)
coords = [
    [location_sender.longitude, location_sender.latitude],
    [location_receiver.longitude, location_receiver.latitude]
]
route = client.directions(coordinates=coords, profile='driving-car')
distance_km = route['routes'][0]['summary']['distance'] / 1000
print(f"Khoảng cách giữa hai điểm: {distance_km:.2f} km")

# Bước 3: Tính phí giao hàng
phi_co_ban = 12000  # VNĐ
phi_moi_km = 3000   # VNĐ/km

tong_phi = phi_co_ban + (distance_km * phi_moi_km)
print(f"Tổng phí giao hàng: {tong_phi:.0f} VNĐ") 