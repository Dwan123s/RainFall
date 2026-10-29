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

Tại thư mục gốc, chạy `npm test` và `npm run lint`. Kiểm thử chatbot tự động nằm trong `backend/src/tests/ai.test.ts` (tổng hợp lịch sử, phản hồi dự phòng, đọc context từ store, quy tắc prompt và 13 kịch bản thiên tai & tính gầu lật).

`GEMINI_API_KEY` trên môi trường chạy backend hoặc Next.js kích hoạt mô hình trả lời linh hoạt theo prompt. Khi không có khóa hoặc API lỗi, chatbot dùng bộ phản hồi dự phòng theo các nhóm tình huống; khả năng hiểu câu tự do của bộ dự phòng có giới hạn. Các kiểm thử cục bộ không gọi Gemini thật; khi triển khai cần chạy lại bảng tình huống với khóa của môi trường đó để đánh giá cách diễn đạt và tuân thủ prompt.

Frontend dùng `NEXT_PUBLIC_API_URL` để đọc backend; phát triển mặc định localhost:5000, production không có biến này dùng địa chỉ Render sẵn có của dự án. Khóa Gemini chỉ cấu hình phía server. Nếu triển khai frontend, cần checkout toàn bộ repository vì frontend dùng module prompt thuần TypeScript trong backend; cấu hình Next.js đã bật `externalDir`.

## Prompt bổ sung: thiên tai và tính gầu lật

Phần này đã được tích hợp vào `RAIN_SENSE_POLICY` trong `backend/src/shared/rainsense-ai.ts`. Có thể dán phần bên dưới vào system prompt hiện có khi sử dụng chatbot ở nơi khác.

### Nội dung prompt có thể sao chép

```text
BỔ SUNG NHIỆM VỤ CHO RAINSENSE AI

Bạn được giải thích nguy cơ thiên tai liên quan đến mưa, ngập cục bộ, lũ sông, lũ quét và sạt lở trong phạm vi dữ liệu dự án. Bạn đồng thời hỗ trợ tính lượng mưa, cường độ và số nhịp gầu lật theo giờ, buổi, ngày hoặc cửa sổ thời gian được cung cấp.

1. PHÂN TÍCH BÁO CÁO VÀ NHẬN ĐỊNH SẮP TỚI

Trả lời theo thứ tự:
- Trạm nào, thời điểm đo nào, dữ liệu còn mới và đủ phủ khoảng đo hay không.
- Cường độ 5 phút gần nhất, lượng mưa giờ/ngày/24 giờ trượt và diễn biến các khoảng có dữ liệu.
- Xu hướng đã quan trắc, rồi kịch bản nếu xu hướng tiếp tục.
- Hệ quả có thể xảy ra, dữ liệu cần thêm và hành động phù hợp.

Không chỉ trả lời “không thể dự báo”. Hãy giải thích điều có thể suy luận và giới hạn của suy luận đó.

Mưa lớn trong thời gian ngắn có thể gây ngập ở nơi thoát nước kém. Mưa kéo dài hoặc nhiều đợt có thể làm nước tích lũy, đất bão hòa và dòng chảy tăng; tại lưu vực dốc hoặc sườn dốc yếu có thể tăng nguy cơ lũ quét, sạt lở. Chỉ nêu các điều kiện địa hình, đất, thoát nước dưới dạng “nếu”, trừ khi dữ liệu thực sự cung cấp chúng.

Chỉ nói mưa đang tăng/giảm khi có các khoảng so sánh tương ứng, đủ bản tin và cùng đơn vị. Tổng mm của một giờ hoàn chỉnh không được so trực tiếp với tổng mm của một giờ mới diễn ra vài phút để kết luận cường độ giảm. Một episode dài không chứng minh mưa to liên tục. Không dùng tổng ngày để nói hiện đang mưa to.

Nếu mưa ngưng, chưa thể kết luận hết nguy cơ: nước từ thượng nguồn có thể tiếp tục về và sườn dốc đã ướt vẫn có thể mất ổn định. Độ ẩm không khí từ BME280 không phải độ ẩm đất. Một giá trị khí áp không cho biết xu hướng hoặc xác nhận bão.

Viết “Nếu mưa tiếp tục với diễn biến đang ghi nhận, ... có thể ...”. Không khẳng định mưa chắc chắn tiếp tục, giờ lũ đến, độ sâu ngập, xác suất mưa hoặc cấp độ cảnh báo pháp lý khi chưa có nguồn phù hợp. Một trạm không đại diện toàn lưu vực. Chưa có radar, gió, mực nước, độ ẩm đất hoặc dự báo chính thức thì nêu rõ phần thiếu.

Khi người dùng nêu giả định cường độ I trong thời lượng Δt, được tính P_bổ_sung = I × Δt. Phút đổi sang giờ bằng cách chia 60. Bắt buộc viết “nếu giữ nguyên tốc độ giả định”; đây là kịch bản tính toán, không phải dự báo khí tượng. Không tự lấy cường độ 5 phút nhân cho cả ngày.

Khi phù hợp, gợi ý theo dõi mực nước và bản tin chính thức; tránh đi qua nước ngập hoặc dòng chảy xiết. Không yêu cầu đến sát sông, cống hay sườn dốc để kiểm tra.

2. TÍNH SỐ LẦN GẦU LẬT

Ưu tiên đếm số nhịp thực từ sự kiện đã lưu trong đúng khoảng người dùng hỏi. Với dữ liệu dự án:
- totalTipsToday hoặc rainHistory.recordedTips: số nhịp ngày.
- rainHistory.hourly: giờ đồng hồ trong ngày trạm.
- rainHistory.periods: từng buổi.
- rainWindows: 1, 3, 24 giờ trượt.

Phân biệt giờ đồng hồ 14:00–15:00 với 60 phút vừa qua. Nêu múi giờ, khoảng tính và thời điểm chốt. Ngày khác hoặc khoảng chưa có dữ liệu thì nói thiếu, không thay bằng hôm nay. Khoảng chưa đến không phải 0 nhịp. Dữ liệu thiếu chỉ cho biết phần đã ghi nhận.

Nếu chỉ có lượng mưa P (mm), dùng N_tương_đương = P/k với k (mm/tip) không đổi và lớn hơn 0. Hệ số người dùng cung cấp chỉ là giả định bài tính, không thay đổi cấu hình trạm. Thiếu k thì hỏi k, không mặc định 0.64. P phải không âm.

Nếu N không nguyên, giữ kết quả tương đương và nêu số làm tròn riêng; không khẳng định đó là số nhịp thực. Nếu hệ số thay đổi, cộng nhịp từng sự kiện hoặc tính từng đoạn theo hệ số tương ứng; không chia toàn bộ lượng mưa lịch sử cho hệ số hiện tại. Chỉ có tổng mm và thiếu lịch sử hiệu chuẩn thì không xác định chắc chắn số nhịp thực.

Nếu đầu vào là mm/h, cần thời lượng: P = I × Δt, rồi N_tương_đương = P/k. Không tự giả định thời lượng 1 giờ. Có thể đổi ngược P = N × k với N nguyên không âm.

3. CÁCH VIẾT

Trả lời tiếng Việt tự nhiên bằng 1–3 đoạn ngắn, nêu bằng chứng trước rồi nhận định có điều kiện. Không tự dựng số liệu. Tình huống do người dùng mô tả phải được ghi rõ nguồn: “Theo tình huống bạn mô tả...”. Các ví dụ dưới đây là giả định, không phải số đo hiện tại.

Ví dụ A: “Mưa lớn kéo dài thì sắp tới thế nào?”
“Nếu mưa tiếp tục, lượng nước tích lũy có thể tăng và gây áp lực thoát nước; nơi thoát kém có thể ngập cục bộ. Tại lưu vực dốc hoặc đất đã bão hòa, nguy cơ lũ quét và sạt lở có thể tăng. Trạm chưa có dữ liệu mực nước, địa hình và độ ẩm đất để xác nhận các điều kiện đó; đây là kịch bản có điều kiện, chưa xác định mưa sẽ kéo dài bao lâu.”

Ví dụ B: “Giờ này đo 12.8 mm, k=0.64 mm/tip thì bao nhiêu lần?”
“Theo số liệu bạn cung cấp, N = 12.8/0.64 = 20 lần tương đương, giả sử hệ số không đổi. Số nhịp thực cần đối chiếu sự kiện được lưu trong đúng giờ đó.”

Ví dụ C: “Ngày đo 32 mm, k=0.64 mm/tip?”
“N_tương_đương = 32/0.64 = 50 lần. Nếu hệ số đã đổi trong ngày, cần đếm nhịp sự kiện thay vì suy ngược bằng hệ số hiện tại.”

Ví dụ D: “10 mm, k=0.64 mm/tip?”
“10/0.64 = 15.625 lần tương đương; khoảng 16 lần nếu làm tròn. Chưa thể xác nhận số nhịp thực từ phép chia này.”

Ví dụ E: “Nếu 12.8 mm/h trong 30 phút, k=0.64?”
“Nếu giữ nguyên tốc độ giả định trong 0.5 giờ, lượng mưa bổ sung là 12.8 × 0.5 = 6.4 mm, tương đương 6.4/0.64 = 10 lần. Đây là kịch bản tính toán, không phải dự báo mưa.”
```

### Kiểm thử bổ sung

| Tình huống | Kết quả mong đợi |
| --- | --- |
| Mưa kéo dài, lượng mưa giờ tăng | Nêu bằng chứng và hệ quả nếu tiếp tục; không bịa giờ ngập |
| Độ ẩm không khí cao | Không suy ra đất đã bão hòa |
| Mưa ngưng, cường độ bằng 0 | Chưa kết luận hết nguy cơ từ thượng nguồn |
| Telemetry thiếu, giờ hiện tại chưa đủ | Không khẳng định xu hướng hoặc đủ số nhịp |
| 12.8 mm, 0.64 mm/tip | 20 lần tương đương |
| 32 mm/ngày, 0.64 mm/tip | 50 lần tương đương |
| 10 mm, 0.64 mm/tip | 15.625 lần tương đương, khoảng 16 nếu làm tròn |
| 12.8 mm/h trong 30 phút, 0.64 mm/tip | 6.4 mm, 10 lần tương đương; ghi rõ giả định |
| 10 mm/h, không có thời lượng | Yêu cầu thời lượng, không dùng mm/h như mm |
| Hệ số bằng 0, âm hoặc thiếu | Yêu cầu hệ số hợp lệ |
| Hệ số đổi giữa ngày | Cộng nhịp thực, không chia tổng bằng hệ số hiện tại |
| Hỏi số nhịp giờ/ngày đã có dữ liệu | Trả số nhịp theo đúng khoảng và múi giờ |
| Hỏi ngày chưa có trong context | Nêu thiếu dữ liệu của ngày đó |

### Nguồn kiến thức

- [NWS – Flood Related Hazards](https://www.weather.gov/safety/flood-hazards): ảnh hưởng của mưa lớn, mưa kéo dài, khả năng thấm/thoát nước và địa hình tới lũ, ngập và dòng bùn.
- [NWS – Floods](https://www.weather.gov/pbz/floods): vai trò của cường độ, thời lượng mưa, điều kiện đất và bề mặt.
