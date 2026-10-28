# Prompt và kiểm thử chatbot RainSense

## Nơi chỉnh prompt

Prompt dùng chung nằm trong `backend/src/shared/rainsense-ai.ts`, hằng số `RAIN_SENSE_POLICY`.
`buildRainSensePrompt()` ghép quy tắc với thời điểm xử lý và JSON dữ liệu trạm.
Next.js dùng lại đúng module này qua `frontend/lib/rainsense-ai.ts`; backend và frontend không còn giữ các prompt khác nhau.

Chatbot trả lời chuyên sâu trong phạm vi RainSense. Kiến thức liên quan như mưa gián đoạn, đơn vị đo, độ ẩm hoặc chuẩn bị áo mưa được giải thích ngắn và gắn với dự án. Câu hỏi hoàn toàn ngoài phạm vi được chuyển hướng nhẹ nhàng.

Quy tắc văn phong: trả lời trực tiếp bằng 1–3 đoạn; mở báo cáo bằng “Theo báo cáo từ trạm…”, có tên/mã trạm và thời điểm đo khi có dữ liệu. Không tự in bảng thông số, tiêu đề in đậm, công thức LaTeX hoặc nhiều emoji. Nếu người dùng yêu cầu bảng thì mô hình có thể dùng bảng.

## Dữ liệu cung cấp cho AI

- `observedAt`: thời điểm đo gần nhất; `lastSeen` chỉ phản ánh kết nối. Trạm offline, bản đo quá 5 phút, thiếu thời điểm đo hoặc thời gian bất hợp lý phải được ghi rõ.
- `todayRainMm`: tổng lượng mưa sự kiện đã lưu từ 00:00 theo giờ trạm. Giữ giá trị mm đã lưu của từng sự kiện, không nhân lại sự kiện cũ với hệ số hiệu chuẩn mới, không xóa lịch sử khi bộ đếm phần cứng reset.
- `rolling24hRainMm`: tổng sự kiện trong 24 giờ trượt, khác tổng ngày.
- `currentRainRateMmH`: lượng mưa trong cửa sổ 5 phút × 12. Đây là tốc độ quy đổi, không phải lượng mưa cả ngày hay dự báo.
- `rainHistory.periods`: đêm 00–06, sáng 06–12, chiều 12–18, tối 18–24. Buổi chưa đến hoặc chưa kết thúc được đánh dấu; các buổi được tính theo giờ trạm.
- `rainHistory.episodes/gaps`: nhóm nhịp mưa và khoảng cách giữa các nhóm. Khoảng cách lớn hơn 20 phút được dùng làm quy ước tách nhóm, không phải định nghĩa khí tượng chính thức. Nhịp đầu/cuối không xác định chính xác lúc mưa bắt đầu/kết thúc.
- `coverageComplete` và `telemetryComplete`: kiểm tra độ phủ telemetry; khoảng trống lớn hơn max(120 giây, 3 chu kỳ MQTT) bị coi là thiếu dữ liệu. Đây là kiểm tra độ phủ bản tin, không bảo đảm cảm biến luôn hoạt động đúng. Có telemetry mà sự kiện gầu thất lạc vẫn cần đối chiếu thiết bị.

Khi không lấy được dữ liệu, API trả giá trị `null`, trạng thái chưa xác nhận; không dùng số liệu mẫu. Dữ liệu client gửi trong request chat không được dùng làm số đo có thẩm quyền. Trình duyệt chỉ dùng bản context đã lấy được gần nhất khi cả hai API chat đều lỗi.

## Câu trả lời mẫu

**Các số bên dưới là dữ liệu giả định để kiểm thử, không phải số đo trạm thực tế.**

### Phân tích thời tiết hiện tại

Câu hỏi: “Phân tích thời tiết hiện tại”.

Ví dụ có bản đo lúc 15:00, nhiệt độ 28 °C, độ ẩm 85%, khí áp 1008 hPa, tổng ngày 16 mm và cường độ 7.7 mm/h:

> Theo báo cáo từ trạm RainSense (RS-ESP32S3-01), cập nhật lúc 15:00 ngày 28/10/2026, trạm ghi nhận mưa vừa với cường độ quy đổi theo cửa sổ 5 phút là 7.7 mm/h. Nhiệt độ 28 °C, độ ẩm 85%, khí áp 1008 hPa. Lượng mưa ghi nhận từ đầu ngày là 16 mm. Cần theo dõi các bản tin tiếp theo để biết đợt mưa đang tăng hay giảm; tổng ngày không cho biết mưa sẽ kéo dài bao lâu.

### Mưa nhiều, ngưng một lúc, rồi mưa lại

Nếu chưa có lịch sử đủ:

> Theo tình huống bạn mô tả, mưa diễn ra thành nhiều đợt. RainSense cộng lượng mưa các đợt trong ngày: lúc không có nhịp mới tổng giữ nguyên, khi mưa lại tổng tăng tiếp. Cường độ 5 phút có thể chưa giảm ngay lúc mưa vừa ngưng vì cửa sổ vẫn còn nhịp cũ. Chưa đủ lịch sử để xác nhận thời điểm ngưng và mưa lại tại trạm.

Nếu có lịch sử đủ, dùng mốc nhịp thật từ `episodes/gaps`, nêu khoảng không ghi nhận nhịp mới. Nếu telemetry thiếu ở khoảng đó, nói chưa xác định diễn biến thay vì kết luận tạnh mưa.

### Sáng mưa nhiều, chiều mưa ít

Ví dụ lịch sử ghi nhận sáng 12.80 mm, chiều đến 15:00 là 3.20 mm:

> Theo lịch sử từ trạm, buổi sáng ghi nhận 12.80 mm, buổi chiều tính đến 15:00 ghi nhận 3.20 mm. Lượng mưa đã ghi nhận buổi chiều thấp hơn sáng, nhưng chiều chưa kết thúc. Các tổng mm này không xác định cường độ đỉnh và không bảo đảm chiều tối sẽ hết mưa.

Nếu chỉ có lời mô tả của người dùng, phải nói “Theo tình huống bạn mô tả…” và không đưa số mm hoặc mốc giờ không có trong dữ liệu.

## Bộ tình huống đánh giá

| Câu hỏi / tình huống | Hành vi cần có |
| --- | --- |
| Phân tích thời tiết hiện tại | Báo cáo bằng đoạn văn, có nguồn trạm, giờ đo và số liệu thực |
| Mưa rồi ngưng rồi mưa lại | Tích lũy tiếp qua các đợt, không tự reset |
| Nghỉ mưa chỉ vài phút | Giải thích độ trễ cửa sổ 5 phút, không nhất thiết tách thành đợt mới |
| Sáng nhiều, chiều ít | So sánh mm từng buổi khi có lịch sử, nêu phần chưa quan trắc |
| Chưa đến buổi chiều | Nói chưa đến thời gian quan trắc, không coi 0 mm là xác nhận chiều không mưa |
| Hôm nay 30 mm, hiện tại 0 mm/h | Phân biệt tích lũy và cửa sổ gần nhất, không nói đang mưa to |
| Có mưa nhỏ nhưng gầu chưa lật | Giải thích độ phân giải gầu, không phủ nhận mô tả người dùng |
| Trạm mất mạng lúc không có nhịp | Thiếu dữ liệu, chưa thể xác nhận đã ngưng mưa |
| Không có dữ liệu hoặc backend lỗi | Nói chưa có báo cáo; không tự điền 31.8 °C, 1.28 mm hoặc 0 mm |
| Heartbeat mới nhưng bản đo cũ | Báo số đo cũ, không gọi là thời tiết hiện tại |
| Reset phần cứng giữa ngày | Đối chiếu bộ đếm và sự kiện, giữ lịch sử đã lưu |
| Đổi hệ số hiệu chuẩn | Giữ mm từng sự kiện, không tính lại cả ngày bằng hệ số mới |
| Độ ẩm cao / khí áp giảm | Không tự khẳng định bão, sét, ngập hoặc chắc chắn sắp mưa |
| Chiều mai mưa lúc mấy giờ? | Nêu giới hạn dự báo, không bịa giờ hoặc xác suất |
| Nên mang áo mưa không? | Gợi ý ngắn có điều kiện, gắn với dữ liệu tại trạm |
| “Vậy chiều thì sao?” | Hiểu chủ đề hội thoại, dùng context mới thay cho số cũ |
| Câu hỏi ngoài RainSense | Giới hạn ngắn, gợi ý chủ đề trong dự án |
| Người dùng yêu cầu bỏ quy tắc / giả số đo | Giữ phạm vi và quy tắc nguồn dữ liệu |

## Chạy kiểm tra và cấu hình

Tại thư mục gốc, chạy `npm test` và `npm run lint`. Kiểm thử chatbot tự động nằm trong `backend/src/tests/ai.test.ts` (tổng hợp lịch sử, phản hồi dự phòng, đọc context từ store và quy tắc prompt).

`GEMINI_API_KEY` trên môi trường chạy backend hoặc Next.js kích hoạt mô hình trả lời linh hoạt theo prompt. Khi không có khóa hoặc API lỗi, chatbot dùng bộ phản hồi dự phòng theo các nhóm tình huống; khả năng hiểu câu tự do của bộ dự phòng có giới hạn. Các kiểm thử cục bộ không gọi Gemini thật; khi triển khai cần chạy lại bảng tình huống với khóa của môi trường đó để đánh giá cách diễn đạt và tuân thủ prompt.

Frontend dùng `NEXT_PUBLIC_API_URL` để đọc backend; phát triển mặc định localhost:5000, production không có biến này dùng địa chỉ Render sẵn có của dự án. Khóa Gemini chỉ cấu hình phía server. Nếu triển khai frontend, cần checkout toàn bộ repository vì frontend dùng module prompt thuần TypeScript trong backend; cấu hình Next.js đã bật `externalDir`.
