# Chatbot RainSense: cấu hình, kiểm thử và train thử nghiệm

## Đã triển khai

- Express điều phối chat; Next.js chỉ kiểm tra request và proxy. Khóa AI chỉ cần ở backend.
- Kho kiến thức có 14 tài liệu, chia thành 36 mục; tìm kiếm từ khóa tiếng Việt có chuẩn hóa dấu, giữ nguồn và phiên bản. Đây là RAG cục bộ theo từ khóa, không phải embedding hay mô hình đã fine-tune. Phân biệt riêng nguồn cấp BME280, Hall A3144 và module chưa rõ model.
- Biên dịch tài liệu vào TypeScript khi dev/test/build; chỉ lấy `status=verified`, không đọc toàn bộ repository hoặc firmware chứa thông tin kết nối vào prompt.
- Tính gầu lật bằng code trước khi gọi AI, dùng hệ số người dùng nêu hoặc cấu hình trạm; giữ nguyên lịch sử hiệu chuẩn của sự kiện.
- Tính thống kê môi trường, thay đổi nhiệt độ 1 giờ và khí áp 3 giờ; kiểm tra độ phủ và loại số đo ngoài khoảng hợp lệ. Không coi thiếu chuỗi là ổn định, không gọi khí áp giảm là bão.
- Context có thời điểm đo, nguồn PostgreSQL/RAM/hỗn hợp, chế độ demo, độ mới và cờ chạm giới hạn lịch sử. Ghi nhận nguồn thực tế của từng request, kể cả khi query DB thất bại rồi đọc RAM.
- Dự báo Open-Meteo gồm nhiệt độ, RH, khí áp bề mặt và giáng thủy theo tọa độ cấu hình; không cần Gemini cho câu hỏi dự báo. Kiểm tra đơn vị, mốc giờ, giá trị thiếu và thời hạn cache 10 phút; không lấy bản cache quá hạn khi API lỗi.
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

## Báo cáo theo khoảng và phân biệt nước thử (03/11/2026)

- Nhận “1 tiếng”, “một tiếng”, “1 giờ”, “1h”, “60 phút”, hôm nay/hôm qua và khoảng giờ trong cùng ngày. Truy vấn tối đa 7 ngày. Khoảng tương lai, không hợp lệ hoặc mốc chưa rõ được yêu cầu làm rõ; không tự thay bằng tổng 24 giờ.
- `metadata.mode=analysis`: backend tính trung bình các bản đo, min/max, giá trị cuối, số bản đo và mốc thực có cho từng đại lượng. Thiếu một cảm biến không loại dữ liệu tốt của cảm biến khác. Không dùng điều kiện đủ 3 giờ khí áp để từ chối một báo cáo 1 giờ. Khi thiếu độ phủ vẫn báo phần ghi nhận, không coi đó là trung bình đại diện cả khoảng.
- Dashboard và chatbot dùng `readRainLedger`, cộng số mm đã lưu từng sự kiện. Sửa cả WebSocket trên trang overview: không thay tổng ngày bằng bộ đếm phần cứng và không chặn tổng giảm khi nhãn thử được áp dụng. Biểu đồ theo múi giờ trạm; giờ/ngày là cửa sổ [from,to), cửa sổ đang chốt nhận cả sự kiện tại mốc chốt.
- `RainEvent.intervalFrom` và `timingQuality`: `device_tip` là một nhịp có giờ thiết bị; `telemetry_interval` là số nhịp tăng trong khoảng bản tin, `legacy` là dữ liệu cũ chưa biết giờ từng nhịp. Không thể dựng lại chính xác giờ từng nhịp từ ảnh hoặc bộ đếm tổng. Lô sát ranh giới giờ/ngày có thể còn bất định, phải nói rõ.
- Không xóa lịch sử trong seed khởi động hoặc khi bộ đếm ESP32 reset. Bản tin MQTT được lưu trước khi đánh dấu trùng; `sequenceNumber` thông thường không còn bị hiểu thành `rain_reset_sequence`. Dùng hàng đợi theo trạm và một bộ đối chiếu counter cho luồng nhịp riêng/telemetry để tránh cộng hai lần.
- Các nhãn `RainTestPeriod` lưu riêng, có người tạo và ghi chú. Chồng khoảng thử thì tách cả lô, giữ nguyên sự kiện gốc. Mặc định ngoài thử là **chưa xác minh mưa tự nhiên**. Không được gọi nước thử là mưa to, không đưa vào báo cáo/dự báo thời tiết; dữ liệu giả lập cũng được giữ nhãn sau khi tắt DEMO.

Trang `/rainfall` có bảng đối chiếu tối đa 100 sự kiện cuối của truy vấn (tối đa 2.000 sự kiện), mốc giờ Việt Nam và phân loại. Quản trị đăng nhập bằng tài khoản backend để chọn khoảng thử cũ hoặc bắt đầu phiên thử 1 giờ, kết thúc sớm khi xong. Phiên đặt qua API không kéo dài quá 2 giờ tương lai. Nút “Toàn bộ đã ghi là thử nước” đánh dấu toàn bộ dữ liệu **đến mốc chốt**, không tự đánh dấu vô hạn các nhịp tương lai.

API bổ sung:

- `GET /api/devices/:id/rain-audit?from=ISO&to=ISO`: sổ đối chiếu, nguồn lưu và các khoảng thử; tối đa 7 ngày.
- `POST /api/devices/:id/rain-test-periods`: `{from,to,note}`; JWT ADMIN.
- `PATCH /api/devices/:id/rain-test-periods/:periodId/stop`: kết thúc phiên; JWT ADMIN.
- `POST /api/devices/:id/rain-test-periods/all-recorded`: đánh dấu toàn bộ lịch sử đến lúc chốt; JWT ADMIN và bắt buộc đọc thành công PostgreSQL. Không báo lưu bền vững nếu chỉ có RAM.

Khi khởi động, `ensureRainSchema` chỉ thêm các cột còn thiếu và bảng nhãn/index bằng SQL idempotent; không chạy reset hay nhận mất dữ liệu. Tài khoản DB cần quyền ALTER/CREATE cho lần nâng cấp. Lỗi đọc nhãn không được coi như không có nhãn. Khi DB chưa kết nối, chế độ RAM luôn được báo rõ; không coi RAM là lưu trữ bền vững.

Các bài kiểm thử mới dùng số đo tổng hợp trong fixture và xác minh bằng API HTTP cục bộ; không xả nước hoặc giả lập dữ liệu vào trạm thật.

## Rà soát các nhánh hội thoại và thời gian

- Báo cáo số đo hiện tại được tính cục bộ trước khi gọi mô hình; trả đủ đại lượng được hỏi, kể cả câu ngắn “Nhiệt độ, độ ẩm, áp suất?”. Một câu hỏi có “áp suất” không còn làm mất nhiệt độ và độ ẩm. Giữ thời điểm đo, cảnh báo bản ghi cũ và phần nước thử.
- Trợ lý dự phòng cũng dùng cách diễn giải trung tính về nước qua gầu, không tự gọi lưu lượng quy đổi là “mưa rất to”. Câu “hiện tại có mưa không” đi vào đọc quan trắc, không bị hiểu thành yêu cầu dự báo.
- Khoảng quan trắc nhận thời lượng ghép “1 giờ 30 phút”, “một tiếng rưỡi”, “nửa giờ”, “hai tiếng”; nhận các buổi hôm nay/hôm qua và giờ dạng 13h15. Mốc đơn “2 giờ trước”, nhiều khoảng cạnh tranh, mốc giờ sai hoặc ngày/tuần/tháng chưa hỗ trợ được làm rõ, không thay bằng hôm nay hoặc chỉ lấy con số đầu tiên.
- “Còn hiện tại?” không kế thừa “hôm qua” từ câu trước. Khi chỉ đổi thời lượng, giữ đủ các đại lượng đã hỏi; chỉ kế thừa chủ đề và khoảng thời gian, không lấy số đo trong lời người dùng làm dữ liệu.
- Bộ phân tích thời lượng được chia sẻ với dự báo: “1 tiếng tới” và “60 phút tới” không bị đổi thành mặc định 6 giờ. Dự báo vẫn chỉ trả các khoảng giờ trọn vẹn của nguồn bên ngoài; câu hỏi nhiều mốc hoặc không đủ một giờ được báo giới hạn.
- Cảnh báo RAM áp dụng cả khi chỉ có sự kiện gầu hoặc một phần cảm biến hợp lệ. Context của báo cáo cập nhật đồng bộ khoảng thống kê, nguồn và trạng thái khí áp. Biệt danh múi giờ Việt Nam Asia/Saigon dùng cùng ranh giới ngày/tháng với Asia/Ho_Chi_Minh.

Bộ kiểm thử hồi quy `backend/src/tests/ai-regressions.test.ts` được bổ sung từ các lỗi tái hiện được trước khi sửa. Việc kiểm thử không thay cho đánh giá dự báo ngoài thực địa hoặc bảo đảm mọi cách diễn đạt tiếng Việt đều đã được hỗ trợ.


## Chế độ chuyên gia RainSense (09/11/2026)

Xem `RAINSENSE_AI_EXPERT.md` để cấu hình hội thoại mở, hồ sơ BMP180/DHT11/BME280, tọa độ dự báo và bộ câu hỏi nghiệm thu. Mặc định trả lời ngắn; chỉ mở rộng khi người dùng yêu cầu chi tiết. Kiến thức đã đối chiếu firmware `1640dba`: mã OLED hiện dùng BMP180 + DHT11, không tự nhận diện mạch đang nạp chỉ từ cờ `bme280_found`.

`npm run knowledge:build --workspace=backend` cũng đồng bộ các module thuần TypeScript từ `backend/src/shared` sang `frontend/shared`. Bản sao được commit để frontend tiếp tục build độc lập theo cấu trúc triển khai hiện tại; CI kiểm tra bản sao không lệch sau khi biên dịch kiến thức.
