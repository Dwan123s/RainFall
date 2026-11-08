# RainSense AI: chuyên môn dự án và trả lời đúng trọng tâm

## Hành vi đã triển khai

- Hiểu luồng phễu → gầu/nam châm/Hall → ESP32-S3 → MQTT → Express/PostgreSQL → Socket.IO/Next.js. Có kiến thức về nguồn, mass, trở kéo lên, I2C, OLED, phụ kiện bảo vệ, hiệu chuẩn và sai số.
- Đối chiếu phiên bản: firmware OLED trên main hiện dùng BMP180 + DHT11, bản khác dùng BME280. Mã nguồn/hồ sơ cấu hình và mạch thực tế được phân biệt; không lấy nhãn UI hoặc `bme280_found` làm bằng chứng đã lắp BME280.
- Giải thích nhiệt độ, RH, điểm sương, khí áp tại trạm/mực biển, mm/mm/h; phân tích các xu hướng có chuỗi đo hỗ trợ và nêu nhận định có điều kiện. Nước thử được tách riêng.
- Tính hiệu chuẩn bằng code từ mL, diện tích/đường kính phễu và số nhịp; tính gầu lật, tổng và thống kê bằng dữ liệu đã lưu. Không thay đổi cấu hình hoặc lịch sử chỉ vì người dùng đưa con số vào chat.
- Dự báo bên ngoài dùng Open-Meteo theo tọa độ; có nhiệt độ, RH, khí áp bề mặt, lượng và xác suất giáng thủy. Trả lời đúng đại lượng được hỏi, kiểm tra đơn vị và giữ mốc thời gian của nguồn.
- Câu đơn giản trả lời trực tiếp, thường 50–110 từ. Báo cáo nhiều đại lượng có thể dài hơn để đủ số liệu và độ phủ. “Giải thích chi tiết”, “từng bước” mở rộng câu trả lời; “ngắn gọn” ưu tiên tóm tắt.

Đây là nâng cấp kiến thức có nguồn, điều phối công cụ và hướng dẫn trả lời; chưa chạy job fine-tune mô hình trả phí. Nhận định từ cảm biến là định tính, chưa phải mô hình xác suất mưa được huấn luyện và đánh giá tại trạm.

## Cấu hình vận hành trên backend

Trong biến môi trường dịch vụ Express hoặc `.env` backend được Git bỏ qua:

```dotenv
GEMINI_API_KEY="YOUR_PRIVATE_KEY"
AI_FORECAST_ENABLED=true
AI_STATION_PROFILES='{"RS-ESP32S3-01":{"hardwareVariant":"oled-s3","wiringVerified":false,"environmentSensors":"unknown"}}'
```

Giữ khóa ở backend. Điền khóa hợp lệ của tài khoản cung cấp mô hình, không đưa vào chat, Git hoặc biến `NEXT_PUBLIC_*`. Các model dùng biến `GEMINI_MODEL` và `GEMINI_FALLBACK_MODEL` hiện có; quyền truy cập model tùy tài khoản. Thiếu/lỗi khóa vẫn có tra cứu cục bộ, tính toán và phân tích bằng code; metadata nói đúng chế độ dự phòng.

Khi đã xác nhận bộ cảm biến đang lắp, đổi `environmentSensors` thành `bmp180-dht11` hoặc `bme280`. Trường này không tự nạp firmware. `wiringVerified` chỉ bật sau khi kiểm tra đấu nối đúng biến thể; `unknown` vẫn là lựa chọn hợp lệ khi chỉ có thông tin Git.

Để dự báo đúng nơi, bổ sung `latitude` và `longitude` là hai số thực của trạm vào hồ sơ trên; có thể thêm `elevationMeters`. Repository chưa cho tọa độ thật nên không điền vị trí mẫu thay người dùng. Khi thiếu tọa độ, bot vẫn phân tích được dữ liệu trạm nhưng báo chưa có dự báo theo vị trí.

`GET /api/ai/context?deviceId=RS-ESP32S3-01` có `capabilities.languageModelConfigured` và `forecastLocationConfigured` để kiểm tra đã cấu hình hay chưa. Cờ khóa có mặt không chứng minh quyền truy cập model; thử một câu kiến thức và xem `metadata.mode/provider` để kiểm tra đường gọi thật.

## Các câu hỏi nghiệm thu

| Câu hỏi | Kết quả cần có |
|---|---|
| Dự án hiện dùng cảm biến nào? | Nêu BMP180 + DHT11 trong mã OLED hiện hành, phân biệt BME280/phiên bản thực tế. |
| BMP180 có đo độ ẩm không? | Không; RH của bộ hiện tại đến từ DHT11. |
| Điện trở kéo lên I2C làm gì? | Giải thích open-drain, mức cao, địa chỉ/dây/mass; không lạc sang dự báo. |
| Vì sao nhiệt độ giảm mà RH tăng? | Giải thích phụ thuộc nhiệt độ; không tự kết luận đã thêm hơi nước hoặc sắp mưa. |
| Áp suất 1013 hPa có chắc trời đẹp không? | Phân biệt mốc chuẩn, độ cao, chuỗi và loại khí áp. |
| Hiệu chuẩn 100 ml, 100 cm², 20 nhịp? | k=0,5 mm/lần theo số người dùng; chưa lưu cấu hình. |
| Phễu tròn đường kính 10 cm, 100 ml, 20 nhịp? | A≈78,54 cm²; k≈0,63662 mm/lần. |
| Phân tích thời tiết hiện tại | Chỉ dùng số trạm thật, xu hướng đủ chuỗi và nhận định định tính; tách nước thử. |
| 30°C, RH 90%, 100000 Pa thì có mưa không? | Gắn nhãn bộ số do người dùng cung cấp, đổi thành 1000 hPa, không tự tạo xác suất. |
| Dự báo áp suất và độ ẩm ngày mai | Khi đủ vị trí/nguồn: khí áp bề mặt và RH, đúng khoảng; không đọc thêm mọi chỉ số. |
| Giải thích chi tiết / nói ngắn gọn | Điều chỉnh độ dài, giữ cùng đơn vị và giới hạn bằng chứng. |

## Kiểm tra mã và kiến thức

```powershell
npm run prisma:generate --workspace=backend
npm test
npm run lint
npm run build
```

Kho `docs/knowledge` hiện có 14 tài liệu/36 mục được duyệt, giữ nguồn và ngày đối chiếu. Sửa kiến thức ở đó; sửa module dùng chung trong `backend/src/shared`, rồi chạy `npm run knowledge:build --workspace=backend`. Bước này cập nhật `knowledge.generated.ts` và bản sao `frontend/shared`. Commit cả hai để frontend build độc lập vẫn có kiến thức mới. CI kiểm tra đồng bộ.

Kiểm thử mô hình trong CI dùng phản hồi giả lập và kiểm tra prompt/nguồn/ngân sách độ dài; chúng không thay đánh giá câu trả lời của model thật hoặc độ chính xác dự báo ngoài thực địa. Không dùng dữ liệu xả thử làm nhãn thời tiết để huấn luyện mô hình mưa.
