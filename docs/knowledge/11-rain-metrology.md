<!-- {"documentId":"rain-metrology","title":"Đo mưa bằng gầu lật và sai số","version":"1.0","hardwareVariant":"all","firmwareVersion":"any","verifiedAt":"2026-11-09","status":"verified","source":"https://github.com/Dwan123s/RainFall/tree/main/firmware","sectionSources":{"Mưa giả và giới hạn cơ cấu":"https://www.bom.gov.au/resources/learn-and-explore/radar-and-equipment-knowledge-centre/flood-river-and-rain-gauges"},"keywords":["phễu","diện tích","đường kính","thể tích","ml","cm2","gầu","cân bằng","hiệu chuẩn","sai số","nam châm","debounce","khóa","độ phân giải","mưa giả"]} -->

## Phễu, thể tích và hiệu chuẩn
1 mm mưa tương đương 1 lít nước trên 1 m². Phễu biến độ sâu mưa thành thể tích chảy vào gầu; diện tích tính theo miệng hứng, không theo đáy lỗ thoát. Với phễu tròn đường kính d, A=πd²/4. Khi V tính bằng mL, A bằng cm² và N là số nhịp dương, k=10V/(A×N) mm/lần. Ghi lượng nước còn trong gầu trước/sau thử, rò rỉ và số nhịp thực; lặp ở nhiều lưu lượng để kiểm tra độ lặp lại. Hệ số tính ra chưa tự cập nhật cấu hình.

## Cân bằng gầu, nam châm và khóa chống đếm
Gầu cần nằm cân để hai ngăn có ngưỡng lật gần nhau; ma sát, lệch trục hoặc nước bám làm thể tích lật thay đổi. Nam châm phải đi qua vùng Hall đủ để tạo một cạnh ngắt hợp lệ mỗi lần lật. Firmware OLED hiện dùng cạnh FALLING và khóa 200 ms; đây là tham số mã nguồn, không phải chứng nhận lưu lượng đo tối đa. Khóa dài có thể bỏ nhịp, khóa ngắn có thể nhận nhiễu; kiểm tra tín hiệu và số lần lật cơ khí trước khi đổi ngưỡng.

## Độ phân giải và cường độ
Một nhịp làm tổng tăng theo k nên mưa nhỏ có thể chưa đủ lật; 0 nhịp không chứng minh không có giọt mưa. Cường độ cửa sổ 5 phút là lượng nước trong 5 phút nhân 12; một nhịp 0,64 mm đã tạo 7,68 mm/h quy đổi. Đổ thử nhanh có thể tạo số lớn mà không có mưa tự nhiên. Lô nhịp suy từ bộ đếm chỉ biết khoảng giữa hai bản tin, không biết giờ từng nhịp; không suy ngược lịch sử bằng hệ số mới.

## Mưa giả và giới hạn cơ cấu
Gầu có thể lật khi không có mưa do rung, nước đọng từ lần trước hoặc sương bổ sung vào lượng nước sẵn có. Nước xả thử cũng tạo tín hiệu giống nước mưa. Đặt cơ cấu cân, bảo đảm phễu sạch và quan sát thực tế giúp đối chiếu; riêng Hall không phân biệt nguồn nước. RainSense giữ nhãn thử riêng và loại phần đã đánh dấu khỏi nhận định thời tiết, đồng thời không tự coi mọi nhịp còn lại là mưa đã xác minh.
