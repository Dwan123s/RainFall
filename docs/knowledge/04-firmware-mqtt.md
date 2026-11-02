<!-- {"documentId":"firmware-mqtt","title":"Firmware và MQTT","version":"1.0","hardwareVariant":"all","firmwareVersion":"any","verifiedAt":"2026-11-02","status":"verified","source":"https://github.com/Dwan123s/RainFall/tree/main/firmware","keywords":["mqtt","broker","topic","tls","firmware","oled","wifi","postgresql","socket","truyền","station01"]} -->

## Các biến thể firmware và bản tin
IOT_MQTT_TLS có OLED SH1106, SDA8/SCL9/Hall10, khoảng khóa 200 ms và hệ số trong mã 0,64 mm/lần; gửi topic weather/station01/data và weather/station01/status. RainSense_ESP32S3 dùng topic weather/{deviceId}/telemetry, /rain, /status, /command, /command/ack, /config; hệ số mặc định trong mã 0,25 mm/lần. Không trộn topic, pinout và hệ số giữa hai bản; dùng cấu hình trạm/backend và sự kiện để xác định số đo hiện hành.

## Truyền và lưu dữ liệu
Wi-Fi kết nối mạng, MQTT truyền bản tin qua broker; TLS mã hóa kết nối khi cấu hình đúng chứng chỉ. Backend nhận dữ liệu, chuẩn hóa payload tương ứng và chống cộng trùng bằng định danh bản tin/sự kiện. PostgreSQL lưu lịch sử, Socket.IO đẩy cập nhật cho web. Việc broker kết nối không chứng minh BME280 có số đo mới hoặc trạm vật lý đang online. Cần kiểm tra timestamp, mã trạm, telemetry và đường ánh xạ station01 với trạm dashboard.
