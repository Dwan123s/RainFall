<!-- {"documentId":"rain-calibration","title":"Hiệu chuẩn và tính gầu lật","version":"1.0","hardwareVariant":"all","firmwareVersion":"any","verifiedAt":"2026-11-02","status":"verified","source":"https://github.com/Dwan123s/RainFall","keywords":["hiệu chuẩn","gầu","gàu","lật","mm","mm/h","công thức","hệ số","diện tích","thể tích","độ phân giải"]} -->

## Lượng mưa và số lần lật
Mỗi sự kiện có số nhịp và hệ số tại thời điểm đo: lượng mưa mm = tổng(tipCount × calibrationFactor). Nếu hệ số k không đổi, số lần tương đương N = P/k. 12,8 mm với k=0,64 mm/lần tương đương 20 lần. 10/0,64=15,625 lần tương đương; số nhịp thực phải là số nguyên và phụ thuộc nước có sẵn trong gầu, hiệu chuẩn và điều kiện đo. Khi hệ số đổi, phải đếm sự kiện hoặc tính riêng từng đoạn, không dùng hệ số hiện tại chia tổng lịch sử.

## Cường độ và độ phân giải
Cường độ mm/h = lượng mưa trong cửa sổ × 60 / số phút. Một lần 0,64 mm trong 5 phút tạo tốc độ quy đổi 7,68 mm/h; đây chưa phải tổng mưa một giờ. 0 nhịp có thể do mưa nhỏ chưa đủ lật; mất telemetry thì chưa xác định. Tổng ngày từ 00:00 giờ trạm khác 24 giờ trượt. Giữ nguyên tốc độ để tính tương lai chỉ là kịch bản có điều kiện, không phải dự báo khí tượng.

## Hiệu chuẩn bằng thể tích
Đo diện tích miệng phễu A (cm²), cho thể tích nước V (mL) đã đo qua phễu và đếm N lần lật: k=10×V/(A×N), đơn vị mm/lần. A và N phải lớn hơn 0. Lặp lại ở các lưu lượng phù hợp để xem sai số, kiểm tra phễu sạch, gầu cân và không rò nước. Không sao chép hệ số 0,64 hoặc 0,25 khi chưa hiệu chuẩn đúng cơ cấu.
