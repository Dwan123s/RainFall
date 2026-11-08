<!-- {"documentId":"project-overview","title":"Luồng hoạt động RainSense","version":"1.2","hardwareVariant":"all","firmwareVersion":"any","verifiedAt":"2026-11-09","status":"verified","source":"https://github.com/Dwan123s/RainFall","keywords":["nguyên lý","hoạt động","luồng","dự án","kiến trúc","website","biểu đồ"]} -->

## Luồng từ nước mưa đến website
Nước đi qua phễu vào cơ cấu gầu lật. Nam châm chuyển động cùng gầu làm Hall A3144 thay đổi tín hiệu; ESP32-S3 đếm cạnh ngắt hợp lệ. Firmware OLED hiện đọc BMP180 (nhiệt độ/khí áp) và DHT11 (RH); bản dùng BME280 đo cả ba đại lượng. Firmware gửi bản tin qua Wi-Fi và MQTT. Backend Express chuẩn hóa dữ liệu, kiểm tra trùng, tính lượng mưa và lưu qua Prisma/PostgreSQL; Socket.IO cập nhật dashboard Next.js. Backend có bộ nhớ RAM dự phòng khi không đọc được database, nên lịch sử ở chế độ này có thể thiếu và mất khi khởi động lại.

## Chức năng website và chatbot
Tổng quan hiển thị số đo mới nhất và trạng thái trạm. Phân tích lượng mưa xem tổng, cường độ và diễn biến; phân tích môi trường xem nhiệt độ, độ ẩm, khí áp. Quản lý thiết bị, cảnh báo và lịch sử phục vụ vận hành. Chatbot đọc context từ backend và tra cứu tài liệu đã duyệt; số liệu trong hội thoại cũ không thay thế bản đo mới.

## Mục đích và lợi ích của dự án
RainSense là trạm khí tượng IoT giúp theo dõi nhiệt độ không khí, độ ẩm, khí áp và lượng mưa tại nơi đặt trạm. Dự án tự động thu thập, lưu lịch sử và hiển thị số liệu trên website để người dùng quan sát diễn biến môi trường từ xa. Các phần tổng hợp, phân tích và cảnh báo hỗ trợ nhận biết thay đổi, đánh giá sơ bộ nguy cơ do mưa và chủ động theo dõi điều kiện tại chỗ. Đây cũng là mô hình học tập/thử nghiệm tích hợp cảm biến, vi điều khiển, truyền dữ liệu và ứng dụng web.
