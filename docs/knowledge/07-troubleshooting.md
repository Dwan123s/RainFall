<!-- {"documentId":"troubleshooting","title":"Kiểm tra lỗi trạm","version":"1.0","hardwareVariant":"all","firmwareVersion":"any","verifiedAt":"2026-11-02","status":"verified","source":"https://github.com/Dwan123s/RainFall","keywords":["lỗi","offline","ngoại tuyến","không nhận","không đếm","không tăng","kẹt","bme280","oled","wifi","mất mạng"]} -->

## Không có số đo hoặc trạm ngoại tuyến
Kiểm tra nguồn, Wi-Fi, timestamp telemetry, mã trạm và topic đúng biến thể firmware. Broker kết nối hoặc heartbeat mới chưa chứng minh bản đo mới. Với BME280, đối chiếu pinout board và firmware, nguồn, mass, địa chỉ I2C; quét I2C và xem log trước khi kết luận hỏng. OLED và BME280 có thể dùng chung bus nhưng phải đúng địa chỉ và nguồn. Không thấy bản tin mới thì báo dữ liệu cũ, không tự điền 0 cho cảm biến.

## Gầu không đếm hoặc đếm sai
Kiểm tra bằng chứng theo thứ tự: cơ cấu có lật không, nam châm có đi qua Hall không, OUT có đổi trạng thái hợp lệ không, firmware có tăng bộ đếm không, MQTT có gửi đúng trạm không và backend có lưu không. Kiểm tra tắc phễu, gầu lệch, nhiễu, khóa chống đếm, reset và bản tin trùng. Không thấy lượng mưa tăng trong khoảng mất mạng không chứng minh không mưa; giữ dữ liệu lịch sử đã lưu khi bộ đếm phần cứng reset.
