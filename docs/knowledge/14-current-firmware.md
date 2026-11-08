<!-- {"documentId":"current-firmware","title":"Phần cứng trong firmware hiện hành","version":"1.0","hardwareVariant":"all","firmwareVersion":"repository-1640dba","verifiedAt":"2026-11-09","status":"verified","source":"https://github.com/Dwan123s/RainFall/blob/1640dba4689ff1f3f39d79380b48b18ac2ca573f/firmware/IOT_MQTT_TLS/IOT_MQTT_TLS.ino","keywords":["bmp180","bmp280","dht11","bme280","hiện hành","đang dùng","phiên bản","cảm biến","gpio4","sh1106"]} -->

## BMP180, DHT11 và BME280 thuộc bản nào
Mã IOT_MQTT_TLS hiện hành dùng BMP180 đo khí áp/nhiệt độ và DHT11 cung cấp RH; ưu tiên nhiệt độ BMP180, dự phòng bằng DHT11 nếu BMP180 mất và DHT11 còn hợp lệ. BMP180/BMP280 không đo độ ẩm; BME280 tích hợp cả nhiệt độ, RH và khí áp nhưng thuộc bản firmware khác/cũ trong repository. Không khẳng định trạm đang dùng BME280 chỉ từ giao diện hoặc tên trường payload. Mã trong Git chưa xác nhận phiên bản đã nạp và linh kiện vật lý.

## Chân và lịch đọc trong mã OLED hiện tại
I2C SDA=GPIO8, SCL=GPIO9 dùng cho BMP180 và OLED SH1106; DHT11 DATA=GPIO4; Hall=GPIO10; nút BOOT=GPIO0. Cảm biến môi trường được đọc khoảng 2,5 giây/lần; lịch MQTT định kỳ 10 giây, sự kiện thay đổi gầu có khoảng gửi tối thiểu 1 giây. Khóa đếm Hall 200 ms và k=0,64 mm/lần là hằng số mã nguồn. Các mốc đọc, gửi và từng nhịp cơ khí khác nhau; không suy giờ từng nhịp từ thời điểm bản tin.

## Cờ cảm biến và lỗi số đo
Firmware hiện vẫn gửi tên trường bme280_found nhưng giá trị là bmpOk hoặc dhtOk; đó là cờ tổng hợp, không chứng minh có BME280 hay cả hai cảm biến đều tốt. Trường môi trường mất đọc được gửi null theo từng cảm biến. Backend cần coi giá trị không hợp lệ là thiếu dữ liệu, không thay bằng 0 để phân tích khí tượng. DHT11 có thể mất trong khi BMP180 vẫn còn khí áp và nhiệt độ; không vì vậy loại toàn bộ bản đo.
