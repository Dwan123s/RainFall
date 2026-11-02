# Chatbot RainSense: cấu hình, kiểm thử và train thử nghiệm

## Đã triển khai

- Express điều phối chat; Next.js chỉ kiểm tra request và proxy. Khóa AI chỉ cần ở backend.
- Kho kiến thức có 9 tài liệu, chia thành 19 mục; tìm kiếm từ khóa tiếng Việt có chuẩn hóa dấu, giữ nguồn và phiên bản. Đây là RAG cục bộ theo từ khóa, không phải embedding hay mô hình đã fine-tune. Phân biệt riêng nguồn cấp BME280, Hall A3144 và module chưa rõ model.
- Biên dịch tài liệu vào TypeScript khi dev/test/build; chỉ lấy `status=verified`, không đọc toàn bộ repository hoặc firmware chứa thông tin kết nối vào prompt.
- Tính gầu lật bằng code trước khi gọi AI, dùng hệ số người dùng nêu hoặc cấu hình trạm; giữ nguyên lịch sử hiệu chuẩn của sự kiện.
- Tính thống kê môi trường, thay đổi nhiệt độ 1 giờ và khí áp 3 giờ; kiểm tra độ phủ và loại số đo ngoài khoảng hợp lệ. Không coi thiếu chuỗi là ổn định, không gọi khí áp giảm là bão.
- Context có thời điểm đo, nguồn PostgreSQL/RAM/hỗn hợp, chế độ demo, độ mới và cờ chạm giới hạn lịch sử. Ghi nhận nguồn thực tế của từng request, kể cả khi query DB thất bại rồi đọc RAM.
- Dự báo Open-Meteo theo tọa độ cấu hình; không cần Gemini cho câu hỏi dự báo. Kiểm tra đơn vị, mốc giờ, giá trị thiếu và thời hạn cache 10 phút; không lấy bản cache quá hạn khi API lỗi.
- Cửa sổ chat hiển thị chế độ AI/dự phòng/tính toán/dự báo, nguồn tham khảo và cảnh báo dữ liệu cũ. Đổi trạm hoặc làm mới chat sẽ bỏ phản hồi đang chạy của cuộc hỏi cũ.
- Câu hỏi nối tiếp giữ chủ đề và khoảng thời gian từ các lượt người dùng: “ngày mai” → “vậy chiều thì sao?” vẫn hỏi chiều ngày mai. Chủ đề mới và ngày được nêu rõ luôn ưu tiên; không sao chép số đo cũ trong hội thoại thành dữ liệu hiện tại.
- Script train thử nghiệm nhiệt độ sau 60 phút từ dữ liệu quan trắc thật, có đánh giá độc lập theo thời gian; chưa tự động đưa mô hình vào chatbot.

Nguồn đối chiếu repository: `Dwan123s/RainFall`, commit GitHub `4d94c0a28b47bcd72b52c4e1afeb3ac964d1a89e`, đọc ngày 02/11/2026. Firmware OLED khai báo SDA8/SCL9/Hall10, 0,64 mm/lần. Repository chưa cung cấp tọa độ trạm hoặc bằng chứng đấu nối thực tế. Vì vậy hồ sơ mặc định chưa xác minh, không tự đổi dây hoặc sửa firmware thiết bị.

## Cấu hình backend

Thêm vào `.env` backend hoặc môi trường dịch vụ Express:

```dotenv
GEMINI_API_KEY="YOUR_KEY"
GEMINI_MODEL="gemini-3.5-flash-lite"
GEMINI_FALLBACK_MODEL="gemini-3.8-flash"
AI_FORECAST_ENABLED=true
AI_STATION_PROFILES='{"RS-ESP32S3-01":{"hardwareVariant":"oled-s3","wiringVerified":false}}'
OPEN_METEO_API_KEY=""
```

Model ID có thể thay đổi theo khả năng truy cập của tài khoản; khi lỗi, ứng dụng trả lời dự phòng và báo đúng chế độ. Không đặt khóa trong `NEXT_PUBLIC_*` hoặc đưa vào file được commit. Thiếu khóa vẫn dùng được tính gầu, kho kiến thức cục bộ, thống kê và dự báo có tọa độ.

Muốn dự báo, bổ sung `latitude` và `longitude` là số thực của đúng trạm vào object tương ứng trong `AI_STATION_PROFILES`; có thể thêm `elevationMeters`. Không dùng vị trí ví dụ làm vị trí thật. Backend kiểm tra cặp tọa độ và khoảng hợp lệ khi khởi động. Các biến thể được hỗ trợ là `unknown`, `oled-s3`, `rainsense-s3`; chỉ bật `wiringVerified` khi đã kiểm tra thực tế.

Open-Meteo có điều kiện sử dụng riêng cho API công cộng; kiểm tra [giấy phép và gói dịch vụ](https://open-meteo.com/en/pricing) trước khi vận hành thương mại. Nếu có `OPEN_METEO_API_KEY`, hệ thống dùng endpoint customer-api của Open-Meteo. Có thể tắt bằng `AI_FORECAST_ENABLED=false`.

Frontend cần `NEXT_PUBLIC_API_URL` đúng backend; `AI_BACKEND_URL` tùy chọn cho đường proxy phía server. Không còn cần khóa Gemini trên Vercel/Next.js. Sau khi cấu hình, khởi động lại/triển khai lại dịch vụ tương ứng. Cần cập nhật cả backend và frontend để nhận metadata mới.

## Cập nhật kiến thức

Sửa nội dung trong `docs/knowledge/`. Dòng đầu mỗi file là metadata JSON trong comment, gồm mã tài liệu, phiên bản, biến thể, ngày duyệt, trạng thái, nguồn và từ khóa. Mỗi tiêu đề `##` tạo một đoạn tìm kiếm. `verified` nghĩa nội dung đã đối chiếu nguồn; không tự chứng nhận dây vật lý của mọi thiết bị.

```powershell
npm run knowledge:build --workspace=backend
```

File đầu ra `backend/src/shared/knowledge.generated.ts` cần được giữ cùng mã nguồn để bản frontend độc lập có kiến thức dự phòng. Build backend tự cập nhật file. Bản `draft`/`deprecated` không được lập chỉ mục; bộ biên dịch kiểm tra một số mẫu bí mật phổ biến nhưng không thay thế việc duyệt tài liệu. Không đưa password, API key hoặc database URI vào kho kiến thức.

## API và hành vi

- `POST /api/ai/chat`: `{message, history, deviceId}`. Giới hạn câu hỏi 4000 ký tự; chỉ giữ 8 lượt lịch sử hợp lệ; bỏ role system và context do client tự gửi. Mỗi địa chỉ kết nối tối đa 30 request chat/phút trong mỗi tiến trình backend; đây là giới hạn cơ bản, không phải hạn mức theo tài khoản hoặc bộ đếm phân tán.
- `GET /api/ai/context?deviceId=...`: context mới lấy ở server, không cache phía proxy.
- `GET /api/ai/series?deviceId=...&from=ISO&to=ISO`: chuỗi môi trường và thống kê, tối đa 7 ngày, 20.000 bản ghi. Có cờ `historyTruncated`; dữ liệu trả theo thứ tự thời điểm đo. Quyền truy cập kế thừa mô hình dashboard hiện tại: dữ liệu quan trắc công khai, không thêm quyền điều khiển thiết bị cho mô hình.

Response chat có `metadata.mode` (`llm`, `fallback`, `calculation`, `forecast`), `provider`, `model`, `generatedAt`, `fallbackReason` khi có và `sources`. Danh sách nguồn là các tài liệu được cấp cho câu trả lời, không phải bằng chứng mô hình đã sử dụng mọi đoạn.

Context có `capabilities`: trạng thái cấu hình mô hình hội thoại, bật/tắt dự báo, đã có tọa độ hay chưa và số tài liệu đã duyệt. Các cờ này không chứa khóa. Khi chưa cấu hình mô hình hội thoại, giao diện hiển thị “Kiến thức dự án” ngay từ đầu; chatbot vẫn tính toán và tra cứu cục bộ. Không thể tạo khóa Gemini hoặc xác định tọa độ thật chỉ bằng mã nguồn, nên người triển khai cần cung cấp hai cấu hình này để dùng đầy đủ mô hình hội thoại và dự báo theo vị trí.

Câu hỏi thử:

1. “Nếu mưa 12,8 mm, hệ số 0,64 mm/lần thì gầu lật bao nhiêu lần?”
2. “A3144 cấp nguồn 3,3 V được không?”
3. “Từ nước mưa đến biểu đồ web hoạt động như thế nào?”
4. “Xu hướng khí áp trong 3 giờ vừa qua?”
5. “Nhiệt độ trung bình 6 giờ vừa qua?”
6. “Dự báo chiều mai tại trạm?”

Dự báo hỗ trợ các giờ trọn vẹn trong khoảng 6 giờ tới, hôm nay, ngày mai/ngày kia và các buổi, tối đa 72 giờ. Chưa hỗ trợ hỏi tùy ý mọi ngày/giờ hoặc tuần tới. Kết quả phân biệt nhiệt độ tại mốc cuối khoảng và giáng thủy trong khoảng một giờ; `fetchedAt` không được coi là thời điểm phát hành mô hình. Khi thiếu tọa độ, lỗi API, thiếu số liệu hoặc vượt khoảng, chatbot nói rõ giới hạn.

## Train mô hình nhiệt độ thử nghiệm

Script hiện huấn luyện hồi quy ridge cho nhiệt độ tại trạm sau 60 phút, không dự báo xác suất mưa. Đầu vào phải là dữ liệu thật từ PostgreSQL, không ở chế độ demo, không chạm giới hạn bản ghi. Script kiểm tra độ phủ, thời điểm dữ liệu đến server, không dùng bản tin đến muộn làm đặc trưng đã biết trong quá khứ. Tách train/validation/test theo thời gian và loại nhãn tương lai giao sang tập sau; scaler chỉ fit trên train. Báo cáo MAE của mô hình và baseline giữ nguyên nhiệt độ mới nhất.

Ví dụ xuất từng ngày từ backend local trong PowerShell để tránh giới hạn 20.000 bản ghi mỗi query:

```powershell
$apiBase = 'http://localhost:5000'
$stationId = 'RS-ESP32S3-01'
$end = [DateTime]::UtcNow
$begin = $end.AddDays(-7)
$records = @()
for ($cursor = $begin; $cursor -lt $end; $cursor = $cursor.AddDays(1)) {
    $next = $cursor.AddDays(1)
    if ($next -gt $end) { $next = $end }
    $uri = "$apiBase/api/ai/series?deviceId=$stationId&from=$([uri]::EscapeDataString($cursor.ToString('o')))&to=$([uri]::EscapeDataString($next.ToString('o')))"
    $part = (Invoke-RestMethod -Uri $uri).data
    if ($part.source -ne 'postgresql' -or $part.demo -or $part.historyTruncated) {
        throw 'Nguồn không phù hợp để train: cần PostgreSQL, dữ liệu thật và không bị cắt'
    }
    $records += $part.records
}
$payload = @{ deviceId=$stationId; source='postgresql'; demo=$false; historyTruncated=$false; records=@($records | Sort-Object timestamp -Unique) }
$json = $payload | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText((Join-Path (Get-Location) 'backend/observations.json'), $json, [System.Text.UTF8Encoding]::new($false))
```

Chạy tại thư mục gốc `RainFall`:

```powershell
npm run ai:train:weather --workspace=backend -- observations.json experimental-model.json
```

Cần ít nhất 300 mẫu hoàn chỉnh phủ 48 giờ sau khi tạo đặc trưng; đây chỉ là điều kiện để chạy thử, không bảo đảm chất lượng hay đủ đại diện mùa. Tối đa 100.000 bản đo trong file đầu vào. Script từ chối ghi đè file output đã có. Các file dữ liệu và mô hình thử nghiệm được gitignore.

Artifact có `readyForDeployment=false`; chatbot không tải mô hình này. Cần nhiều đợt thời tiết, nhiều mùa, so sánh ngoài mẫu và chạy thử dự báo được lưu trước khi có kết quả thực tế. Muốn thêm xác suất mưa cần nhãn từ sự kiện mưa đã hiệu chuẩn, độ phủ đủ, mục tiêu rõ và đánh giá xác suất riêng; không thể suy ra từ file nhiệt độ này.

## Train cách trả lời của chatbot

Đợt nâng cấp này dùng prompt và RAG, chưa chạy một job fine-tuning trả phí. Để cải thiện, trước tiên chạy bộ câu hỏi nghiệm thu với mô hình thật, ghi câu trả lời sai và sửa tài liệu/prompt. Khi có bộ hội thoại được kiểm tra, tách riêng train và đánh giá, chọn định dạng/model hỗ trợ của nhà cung cấp rồi mới fine-tune. Không dùng số đo hiện tại làm kiến thức cố định trong trọng số mô hình.

## Kiểm tra

```powershell
npm run prisma:generate --workspace=backend
npm test
npm run lint
npm run build
```

Các bài kiểm thử API AI dùng mô hình giả lập có kiểm soát và dữ liệu tổng hợp chỉ trong fixture. Chúng kiểm tra luồng, tính toán, nguồn, lỗi và giới hạn; không chứng minh chất lượng ngôn ngữ của Gemini thật hoặc độ chính xác dự báo tại trạm thực địa.

GitHub Actions trong `.github/workflows/ci.yml` chạy cùng các bước trên khi push `main`, mở pull request hoặc chạy thủ công. Sau `npm ci`, workflow sinh Prisma Client từ schema backend trước khi kiểm tra TypeScript; bước này không kết nối hay thay đổi database. Workflow dùng quyền đọc repository, không dùng khóa production và không tự deploy. Nó cũng kiểm tra file chỉ mục kiến thức đã được cập nhật trong commit. Frontend build tự biên dịch lại kho kiến thức để bản triển khai không dùng tài liệu cũ.
