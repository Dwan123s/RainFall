<!-- {"documentId":"hardware-bom","title":"Mạch, cảm biến và phụ kiện","version":"1.0","hardwareVariant":"all","firmwareVersion":"any","verifiedAt":"2026-11-02","status":"verified","source":"https://github.com/Dwan123s/RainFall/tree/main/firmware","keywords":["mạch","phụ kiện","linh kiện","bme280","esp32","hall","a3144","oled","phễu","nam châm"]} -->

## Vai trò mạch và phụ kiện
ESP32-S3 là bộ điều khiển đọc cảm biến, đếm xung và truyền MQTT qua Wi-Fi. BME280 đo nhiệt độ, độ ẩm tương đối và khí áp; không đo lượng mưa. Phễu có diện tích miệng xác định để thu nước; hai ngăn gầu luân phiên nhận nước và lật. Nam châm và Hall A3144 phát hiện chuyển động; Hall không tự đo mm. OLED SH1106 có trong firmware IOT_MQTT_TLS để hiển thị tại chỗ. Nguồn, dây, trở kéo lên, tụ lọc, hộp bảo vệ và giá đặt là phụ kiện cần kiểm tra theo mạch thực tế; repository chưa xác nhận mọi mã phụ kiện đang lắp.

## Cách Hall và gầu lật phối hợp
Từ trường qua ngưỡng làm ngõ ra Hall đổi trạng thái; firmware dùng ngắt và khoảng khóa chống đếm lặp. Phải kiểm tra một lần lật cơ khí có tạo đúng một xung được đếm không. Khoảng khóa quá ngắn có thể nhận nhiễu; quá dài có thể bỏ xung ở lưu lượng lớn. Tắc phễu, gầu không cân, ma sát, sai vị trí nam châm hoặc thiếu nguồn đều có thể gây sai số, nhưng cần bằng chứng để kết luận nguyên nhân.
