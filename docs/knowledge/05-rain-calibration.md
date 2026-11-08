<!-- {"documentId":"rain-calibration","title":"Hiệu chuẩn và tính gầu lật","version":"1.2","hardwareVariant":"all","firmwareVersion":"any","verifiedAt":"2026-11-09","status":"verified","source":"https://github.com/Dwan123s/RainFall","keywords":["hiệu chuẩn","gầu","gàu","lật","mm","mm/h","công thức","hệ số","diện tích","thể tích","độ phân giải","thử nước","xả nước","đối chiếu"]} -->

## Lượng mưa và số lần lật
Mỗi sự kiện có số nhịp và hệ số tại thời điểm đo: lượng mưa mm = tổng(tipCount × calibrationFactor). Nếu hệ số k không đổi, số lần tương đương N = P/k. 12,8 mm với k=0,64 mm/lần tương đương 20 lần. 10/0,64=15,625 lần tương đương; số nhịp thực phải là số nguyên và phụ thuộc nước có sẵn trong gầu, hiệu chuẩn và điều kiện đo. Khi hệ số đổi, phải đếm sự kiện hoặc tính riêng từng đoạn, không dùng hệ số hiện tại chia tổng lịch sử.

## Cường độ và độ phân giải
Cường độ mm/h = lượng mưa trong cửa sổ × 60 / số phút. Một lần 0,64 mm trong 5 phút tạo tốc độ quy đổi 7,68 mm/h; đây chưa phải tổng mưa một giờ. 0 nhịp có thể do mưa nhỏ chưa đủ lật; mất telemetry thì chưa xác định. Tổng ngày từ 00:00 giờ trạm khác 24 giờ trượt. Giữ nguyên tốc độ để tính tương lai chỉ là kịch bản có điều kiện, không phải dự báo khí tượng.

Dashboard và chatbot cùng cộng rainfallMm và tipCount từ sổ sự kiện theo ngày tại múi giờ trạm, không thay tổng ngày bằng bộ đếm tích lũy trên ESP32. Sự kiện giữ hệ số lúc được lưu. Reset phần cứng và khởi động backend không xóa lịch sử.

Nước đổ thử có thể tạo mm/h quy đổi rất lớn dù chỉ xả ngắn; không được kết luận trời mưa to từ phép thử. Các khoảng được quản trị đánh dấu thử nước tách riêng khỏi tổng, biểu đồ và nhận định thời tiết. Nhịp ngoài khoảng thử vẫn chưa được xác minh là mưa tự nhiên. Dữ liệu giả lập được gắn nhãn thử ngay lúc lưu.

Bản tin bộ đếm chỉ cho biết số nhịp tăng giữa hai lần gửi, không chứa giờ chính xác từng nhịp. Sổ lưu mốc bản tin và intervalFrom, gắn telemetry_interval. Chỉ một bản tin nhịp riêng từ thiết bị mới được gắn device_tip; dữ liệu cũ là legacy. Lô chồng khoảng thử được tách toàn bộ vì không biết nhịp nào thuộc thử. Nhãn khoảng [from,to) không thay đổi số nhịp/mm gốc.

## Hiệu chuẩn bằng thể tích
Đo diện tích miệng phễu A (cm²), cho thể tích nước V (mL) đã đo qua phễu và đếm N lần lật: k=10×V/(A×N), đơn vị mm/lần. A và N phải lớn hơn 0. Lặp lại ở các lưu lượng phù hợp để xem sai số, kiểm tra phễu sạch, gầu cân và không rò nước. Không sao chép hệ số 0,64 hoặc 0,25 khi chưa hiệu chuẩn đúng cơ cấu.

## Cách đo lượng mưa bằng gầu lật
Phễu thu nước vào gầu; khi đủ thể tích, gầu lật làm nam châm đi qua Hall A3144 và ESP32-S3 đếm nhịp hợp lệ. Với hệ số k không đổi, lượng mưa P = N × k, trong đó N là số nhịp và k có đơn vị mm/nhịp; nếu hiệu chuẩn thay đổi thì cộng lượng từng sự kiện theo hệ số lúc đo. Ví dụ giả định k = 0,64 mm/nhịp và N = 10 thì P = 6,4 mm. Cường độ trung bình I = P × 60 / t với t tính bằng phút; 6,4 mm trong 20 phút tương đương 19,2 mm/h cho đoạn đó. Hệ số của cơ cấu thực phải được hiệu chuẩn; Hall phát hiện nhịp, không tự đo mm.
