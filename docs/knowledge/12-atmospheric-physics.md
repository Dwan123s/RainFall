<!-- {"documentId":"atmospheric-physics","title":"Vật lý các thông số khí tượng","version":"1.0","hardwareVariant":"all","firmwareVersion":"any","verifiedAt":"2026-11-09","status":"verified","source":"https://www.weather.gov/arx/why_dewpoint_vs_humidity","sectionSources":{"Nhiệt độ và sai lệch do mạch":"https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bme280-ds002.pdf","Khí áp trạm và mực nước biển":"https://www.noaa.gov/jetstream/atmosphere/air-pressure","Heat index và nhiệt độ cảm nhận":"https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml"},"keywords":["nhiệt độ","độ ẩm","rh","điểm sương","bão hòa","nóng","tự nóng","mực nước biển","độ cao","1013","hpa","pa","heat index"]} -->

## RH tăng khi nhiệt độ giảm
Độ ẩm tương đối RH so sánh lượng hơi nước hiện có với trạng thái bão hòa ở cùng nhiệt độ. Khi không khí lạnh đi mà lượng hơi nước gần như giữ nguyên, RH có thể tăng dù chưa có mưa hay hơi nước mới. Điểm sương phản ánh mức hơi nước và giúp so sánh cảm giác ẩm giữa các nhiệt độ. Vì vậy, “RH tăng” không tự đồng nghĩa “hơi nước tăng” hoặc “sắp mưa”; cần đọc cùng nhiệt độ, điểm sương và chuỗi thời gian.

## Nhiệt độ và sai lệch do mạch
Nhiệt độ cảm biến chịu ảnh hưởng môi trường, tự nung và nhiệt trên PCB; BME280 không tự bảo đảm bằng đúng nhiệt độ không khí ngoài trời. Che bức xạ nhưng giữ thông gió, tách khỏi phần tỏa nhiệt và đối chiếu với dụng cụ tham chiếu giúp đánh giá lệch. Dải hoạt động không đồng nghĩa sai số bằng nhau trong toàn dải. Không sửa bằng một offset tùy ý chỉ vì khác ứng dụng thời tiết ở vị trí khác.

## Khí áp trạm và mực nước biển
1 hPa = 100 Pa; áp suất chuẩn mực nước biển là 1013,25 hPa. Giá trị chuẩn là mốc tham chiếu, không phải ranh giới chắc chắn trời đẹp/mưa. Khí áp thường giảm theo độ cao; dữ liệu BME280/BMP180 tại trạm và khí áp đã quy về biển phải được phân biệt trước khi so sánh. Chu kỳ ngày cũng góp phần làm khí áp thay đổi, đặc biệt gần xích đạo. Dùng xu hướng cùng loại số đo, đúng mốc thời gian và bối cảnh khu vực; không dự báo bão từ một lần giảm.

## Heat index và nhiệt độ cảm nhận
Heat index được tính từ nhiệt độ và RH theo công thức có miền áp dụng, không phải số đo trực tiếp của một cảm biến khác. Hồi quy Rothfusz không phù hợp để dùng tùy ý ở mọi nhiệt độ/độ ẩm hoặc ngoài miền đã nghiên cứu. Khi giải thích chỉ số của RainSense, nêu đây là giá trị tính toán; không coi nó là nhiệt độ không khí đo được, và không dùng chỉ số này để dự báo mưa.
