<!-- {"documentId":"project-overview","title":"Luồng hoạt động RainSense","version":"1.0","hardwareVariant":"all","firmwareVersion":"any","verifiedAt":"2026-11-02","status":"verified","source":"https://github.com/Dwan123s/RainFall","keywords":["nguyên lý","hoạt động","luồng","dự án","kiến trúc","website","biểu đồ"]} -->

## Luồng từ nước mưa đến website
Nước đi qua phễu vào cơ cấu gầu lật. Nam châm chuyển động cùng gầu làm Hall A3144 thay đổi tín hiệu; ESP32-S3 đếm cạnh ngắt hợp lệ. BME280 đo nhiệt độ, độ ẩm tương đối và khí áp. Firmware gửi bản tin qua Wi-Fi và MQTT. Backend Express chuẩn hóa dữ liệu, kiểm tra trùng, tính lượng mưa và lưu qua Prisma/PostgreSQL; Socket.IO cập nhật dashboard Next.js. Backend có bộ nhớ RAM dự phòng khi không đọc được database, nên lịch sử ở chế độ này có thể thiếu và mất khi khởi động lại.

## Chức năng website và chatbot
Tổng quan hiển thị số đo mới nhất và trạng thái trạm. Phân tích lượng mưa xem tổng, cường độ và diễn biến; phân tích môi trường xem nhiệt độ, độ ẩm, khí áp. Quản lý thiết bị, cảnh báo và lịch sử phục vụ vận hành. Chatbot đọc context từ backend và tra cứu tài liệu đã duyệt; số liệu trong hội thoại cũ không thay thế bản đo mới.
