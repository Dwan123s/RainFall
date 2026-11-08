<!-- {"documentId":"measurement-principles","title":"Trạm đo từng thông số bằng cách nào","version":"1.0","hardwareVariant":"all","firmwareVersion":"repository-1640dba","verifiedAt":"2026-11-09","status":"verified","source":"https://github.com/Dwan123s/RainFall/blob/1640dba4689ff1f3f39d79380b48b18ac2ca573f/firmware/IOT_MQTT_TLS/IOT_MQTT_TLS.ino","sectionSources":{"Độ ẩm được đo thế nào":"https://www.electronicoscaldas.com/datasheet/DHT11_Aosong.pdf","Khí áp được đo thế nào":"https://www.mouser.com/datasheet/2/783/BST-BMP180-DS000-1509579.pdf","Nguồn BMP180":"https://www.mouser.com/datasheet/2/783/BST-BMP180-DS000-1509579.pdf","Nguồn và tín hiệu DHT11":"https://www.electronicoscaldas.com/datasheet/DHT11_Aosong.pdf"},"keywords":["làm sao","đo được","bằng gì","nhiệt độ","độ ẩm","khí áp","áp suất","bmp180","dht11","i2c","nguyên lý","đọc số"]} -->

## Nhiệt độ được đo thế nào
Trạm đo nhiệt độ bằng cảm biến, ESP32-S3 đọc kết quả rồi gửi lên website. Trong mã IOT_MQTT_TLS hiện hành, BMP180 cung cấp số đo °C qua I2C; thư viện đọc dữ liệu chuyển đổi và dùng hệ số hiệu chuẩn của cảm biến. Nếu BMP180 không đọc được nhưng DHT11 còn hợp lệ, firmware dùng nhiệt độ DHT11 dự phòng. ESP32-S3 đọc môi trường khoảng 2,5 giây/lần, gửi MQTT định kỳ 10 giây để backend lưu và dashboard hiển thị. Muốn gần nhiệt độ không khí thực, đặt cảm biến thông gió, tránh nắng trực tiếp và nhiệt từ mạch. Mã trong Git chưa xác nhận linh kiện đã lắp/firmware đã nạp; biến thể BME280 dùng cảm biến tích hợp khác.

## Độ ẩm được đo thế nào
DHT11 đo độ ẩm không khí và gửi số %RH qua chân DATA; BMP180 không đo độ ẩm. Theo tài liệu DHT11 của Aosong, phần tử cảm nhận ẩm kiểu điện trở polymer thay đổi theo hơi ẩm, mạch bên trong xử lý thành dữ liệu số đã hiệu chuẩn. ESP32-S3 phát tín hiệu bắt đầu, đọc dữ liệu và kiểm tra checksum qua bus một dây riêng của DHT11; đó không phải I2C. Trong mã OLED hiện hành, DATA là GPIO4. RH không phải độ ẩm đất và không tự xác nhận trời sắp mưa. Với trạm có hồ sơ BME280, đường đo RH thuộc BME280, cần đối chiếu đúng biến thể.

## Khí áp được đo thế nào
BMP180 dùng phần tử áp điện trở và bộ chuyển đổi analog–số để cảm nhận áp suất. Thư viện đọc dữ liệu qua I2C và bù theo nhiệt độ/hệ số hiệu chuẩn trong cảm biến. Firmware đổi Pa sang hPa bằng cách chia 100 trước khi gửi. Đây là áp suất tại trạm, không mặc định đã quy về mực nước biển. Một số đo chưa cho biết xu hướng hoặc xác nhận bão; vẫn có thể báo ngay giá trị đã đo.

## Nguồn BMP180
IC BMP180 có VDD 1,8–3,6 V và VDDIO 1,62–3,6 V theo Bosch; không cấp 5 V trực tiếp vào chân IC. Điện áp VIN cho module có ổn áp có thể khác: kiểm tra đúng module, GND và mức kéo lên SDA/SCL trước khi nối ESP32-S3.

## Nguồn và tín hiệu DHT11
Tài liệu Aosong được đối chiếu ghi nguồn DHT11 3,3–5,5 V; cần kiểm tra đúng phiên bản/module. Khi ghép ESP32-S3, DATA phải có mức logic phù hợp GPIO 3,3 V; không mặc định module cấp 5 V có OUT an toàn. Module có thể tích hợp trở kéo lên DATA. Bus DHT11 khác bus Dallas/Maxim OneWire, cần dùng thư viện đúng loại. Chân DATA phải theo firmware đang nạp, không sao chép sơ đồ từ board khác.
