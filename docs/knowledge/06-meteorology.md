<!-- {"documentId":"meteorology","title":"Nhiệt độ, độ ẩm và khí áp","version":"1.0","hardwareVariant":"all","firmwareVersion":"any","verifiedAt":"2026-11-02","status":"verified","source":"https://www.noaa.gov/education/resource-collections/weather-atmosphere/weather-observations","keywords":["nhiệt độ","độ ẩm","khí áp","áp suất","điểm sương","dew","heat index","bme280","cảm biến","hpa"]} -->

## Độ ẩm tương đối và điểm sương
Độ ẩm tương đối RH là tỷ lệ so với trạng thái bão hòa ở cùng nhiệt độ; không phải lượng nước mưa hoặc độ ẩm đất. Không khí có thể có RH tăng chỉ vì nhiệt độ giảm. Điểm sương là nhiệt độ bắt đầu bão hòa khi làm lạnh với lượng hơi nước gần như giữ nguyên. T gần điểm sương gợi ý không khí gần bão hòa nhưng không xác định chắc chắn sắp mưa. RH cao riêng lẻ không đủ tạo giờ mưa hoặc xác suất.

## Nhiệt độ và cách đặt cảm biến
BME280 đo nhiệt độ tại cảm biến; ánh nắng trực tiếp, hộp kín nóng hoặc nhiệt từ mạch có thể làm số đo lệch với không khí ngoài trời. Cần đặt trong chụp che bức xạ thông thoáng, tránh nước trực tiếp và nguồn nhiệt. Heat index là chỉ số tính từ nhiệt độ và độ ẩm theo điều kiện áp dụng của công thức, không phải một cảm biến nhiệt độ khác. Không tự hiệu chỉnh số đo nếu chưa có tham chiếu.

## Khí áp và xu hướng
Khí áp đo tại trạm khác khí áp quy về mực nước biển. So sánh nguồn ngoài cần biết độ cao, đơn vị và loại khí áp. 1 hPa = 100 Pa. Xu hướng phải tính từ chuỗi đo có độ phủ đủ và đúng khoảng, chẳng hạn chênh lệch 3 giờ. Khí áp giảm nhanh riêng lẻ không xác nhận bão, dông hay sét. Thiếu chuỗi quá khứ phải nói chưa đủ dữ liệu, không mặc định ổn định.
