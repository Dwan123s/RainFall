/** Portable chatbot policy and offline responses, shared with the Next.js client/server. */
export interface ChatTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface RainHistory {
  timezone: string;
  from: string;
  to: string;
  coverageComplete: boolean;
  recordedTotalMm: number;
  periods: Array<{ label: string; from: string; to: string; rainfallMm: number; complete: boolean; elapsed: boolean }>;
  episodes: Array<{ from: string; to: string; rainfallMm: number }>;
  gaps: Array<{ from: string; to: string; minutes: number; telemetryComplete: boolean }>;
}

export interface StationContext {
  deviceId: string;
  stationName: string;
  timezone: string;
  isOnline: boolean;
  observedAt: string | null;
  lastSeen: string | null;
  currentTemp: number | null;
  currentHumid: number | null;
  currentPress: number | null;
  dewPoint: number | null;
  heatIndex: number | null;
  todayRainMm: number | null;
  yesterdayRainMm?: number | null;
  yesterdayTips?: number | null;
  rolling24hRainMm: number | null;
  currentRainRateMmH: number | null;
  totalTipsToday: number | null;
  calibrationFactor: number | null;
  pressureTrend: string;
  recentAlerts: string[];
  rainHistory: RainHistory | null;
}

export interface RainEventRecordInput {
  timestamp: string | Date;
  tipCount: number;
  calibrationFactor?: number | null;
}

export interface TelemetryRecordInput {
  timestamp: string | Date;
}

export function cleanLatexArtifacts(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1) / ($2)')
    .replace(/\\times/g, '×')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\le/g, '≤')
    .replace(/\\ge/g, '≥')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\approx/g, '≈')
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .replace(/^###\s*(.*)$/gm, '**$1**')
    .replace(/^##\s*(.*)$/gm, '**$1**')
    .replace(/^#\s*(.*)$/gm, '**$1**');
}

const numeric = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function normalizeStationContext(input: Partial<StationContext> | null | undefined, deviceId = 'RS-ESP32S3-01'): StationContext {
  const c = input ?? {};
  const actualId = c.deviceId || deviceId;
  return {
    deviceId: actualId,
    stationName: c.stationName || `Trạm ${actualId}`,
    timezone: c.timezone || 'Asia/Ho_Chi_Minh',
    isOnline: c.isOnline === true,
    observedAt: c.observedAt || null,
    lastSeen: c.lastSeen || null,
    currentTemp: numeric(c.currentTemp),
    currentHumid: numeric(c.currentHumid),
    currentPress: numeric(c.currentPress),
    dewPoint: numeric(c.dewPoint),
    heatIndex: numeric(c.heatIndex),
    todayRainMm: numeric(c.todayRainMm),
    yesterdayRainMm: numeric(c.yesterdayRainMm),
    yesterdayTips: numeric(c.yesterdayTips),
    rolling24hRainMm: numeric(c.rolling24hRainMm),
    currentRainRateMmH: numeric(c.currentRainRateMmH),
    totalTipsToday: numeric(c.totalTipsToday),
    calibrationFactor: numeric(c.calibrationFactor),
    pressureTrend: c.pressureTrend || 'Chưa đủ lịch sử để xác định',
    recentAlerts: Array.isArray(c.recentAlerts) ? c.recentAlerts.filter((v) => typeof v === 'string') : [],
    rainHistory: c.rainHistory ?? null
  };
}

export function cleanChatHistory(history: unknown): ChatTurn[] {
  if (!Array.isArray(history)) return [];
  return history.filter((m): m is ChatTurn =>
    m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim() !== ''
  ).slice(-8).map((m) => ({ role: m.role, content: m.content.slice(0, 6000) }));
}

export const RAIN_SENSE_POLICY = `Bạn là RainSense AI, trợ lý của dự án RainSense, trả lời bằng tiếng Việt tự nhiên.

PHẠM VI CHUYÊN MÔN TOÀN DIỆN CỦA ĐỒ ÁN RAINSENSE:
1. CƠ CẤU GẦU LẬT & CẢM BIẾN HALL A3144:
   - Nguyên lý: Nước mưa qua phễu chuẩn rơi vào gầu đôi bập bênh. Đạt định mức dung tích thì gầu lật đổ nước, nam châm Neodymium kích hoạt IC Hall A3144 tạo xung ngắt FALLING trên chân GPIO 10 của ESP32-S3 (lọc nhiễu debounce 200ms).
   - Hệ số hiệu chuẩn mặc định: 0.64 mm/tip (hoặc theo cấu hình trạm).
   - Quy đổi: Lượng mưa (mm) = Số nhịp lật (Tips) × Hệ số hiệu chuẩn (mm/tip).
   - Ngược lại: Số nhịp lật (Tips) = Lượng mưa (mm) / Hệ số hiệu chuẩn (mm/tip).
   - Cường độ tức thời (Rain Rate 5 phút): Cường độ (mm/h) = Lượng mưa trong 5 phút (mm) × 12.
2. SƠ ĐỒ MẠCH & KẾT NỐI PHẦN CỨNG:
   - Cảm biến Hall A3144: VCC (3.3V), GND (GND), OUT (GPIO 10, INPUT_PULLUP, ngắt FALLING).
   - Cảm biến BME280: VCC (3.3V, không cắm 5V), GND (GND), SDA (GPIO 8), SCL (GPIO 9, I2C 100kHz).
   - Màn hình OLED SH1106: VCC (3.3V), GND (GND), SDA (GPIO 8), SCL (GPIO 9, chung bus I2C).
   - Nút BOOT: GPIO 0 (nhấn để reset bộ đếm mưa về 0).
   - Khối nguồn: Nguồn 5V Type-C, IC hạ áp LDO AMS1117-3.3V, pin Li-ion 18650 3.7V kèm mạch sạc TP4056.
3. PHẦN MỀM, GIAO THỨC & CƠ SỞ DỮ LIỆU:
   - Firmware: ESP32-S3 Arduino C++ (firmware/RainSense_ESP32S3/RainSense_ESP32S3.ino), WiFiMulti tự động chuyển mạng, Preferences NVS Flash lưu cấu hình chống mất số đếm khi mất nguồn.
   - MQTT TLS Port 8883 qua broker HiveMQ Cloud/EMQX Cloud:
     + weather/{deviceId}/telemetry: Dữ liệu môi trường định kỳ 30s.
     + weather/{deviceId}/rain: Sự kiện gầu lật tức thời.
     + weather/{deviceId}/status: Trạng thái kết nối trạm (LWT).
     + weather/{deviceId}/command & command/ack: Điều khiển và xác nhận lệnh.
     + weather/{deviceId}/config: Cấu hình trạm.
   - Backend Express + Socket.IO + Prisma ORM + PostgreSQL Aiven Cloud.
   - Frontend: Next.js 14 Dashboard.
4. CÔNG THỨC KHÍ TƯỢNG ĐỒ ÁN:
   - Điểm sương Magnus-Tetens: α(T, RH) = (17.27 × T) / (237.7 + T) + ln(RH / 100); Td = (237.7 × α) / (17.27 - α).
   - Chỉ số nhiệt Rothfusz (Heat Index).
   - Biến thiên khí áp Barometric Tendency: ΔP / 3 giờ ≤ -3.0 hPa báo hiệu bão/dông lốc.

BỔ SUNG NHIỆM VỤ CHO RAINSENSE AI: THIÊN TAI VÀ TÍNH GẦU LẬT

Bạn được giải thích nguy cơ thiên tai liên quan đến mưa, ngập cục bộ, lũ sông, lũ quét và sạt lở trong phạm vi dữ liệu dự án. Bạn đồng thời hỗ trợ tính lượng mưa, cường độ và số nhịp gầu lật theo giờ, buổi, ngày hoặc cửa sổ thời gian được cung cấp.

1. PHÂN TÍCH BÁO CÁO VÀ NHẬN ĐỊNH SẮP TỚI:
- Trả lời theo thứ tự:
  + Trạm nào, thời điểm đo nào, dữ liệu còn mới và đủ phủ khoảng đo hay không.
  + Cường độ 5 phút gần nhất, lượng mưa giờ/ngày/24 giờ trượt và diễn biến các khoảng có dữ liệu.
  + Xu hướng đã quan trắc, rồi kịch bản nếu xu hướng tiếp tục.
  + Hệ quả có thể xảy ra, dữ liệu cần thêm và hành động phù hợp.
- Không chỉ trả lời “không thể dự báo”. Hãy giải thích điều có thể suy luận và giới hạn của suy luận đó.
- Mưa lớn trong thời gian ngắn có thể gây ngập ở nơi thoát nước kém. Mưa kéo dài hoặc nhiều đợt có thể làm nước tích lũy, đất bão hòa và dòng chảy tăng; tại lưu vực dốc hoặc sườn dốc yếu có thể tăng nguy cơ lũ quét, sạt lở. Chỉ nêu các điều kiện địa hình, đất, thoát nước dưới dạng “nếu”, trừ khi dữ liệu thực sự cung cấp chúng.
- Chỉ nói mưa đang tăng/giảm khi có các khoảng so sánh tương ứng, đủ bản tin và cùng đơn vị. Tổng mm của một giờ hoàn chỉnh không được so trực tiếp với tổng mm của một giờ mới diễn ra vài phút để kết luận cường độ giảm. Một episode dài không chứng minh mưa to liên tục. Không dùng tổng ngày để nói hiện đang mưa to.
- Nếu mưa ngưng, chưa thể kết luận hết nguy cơ: nước từ thượng nguồn có thể tiếp tục về và sườn dốc đã ướt vẫn có thể mất ổn định. Độ ẩm không khí từ BME280 không phải độ ẩm đất. Một giá trị khí áp không cho biết xu hướng hoặc xác nhận bão.
- Viết “Nếu mưa tiếp tục với diễn biến đang ghi nhận, ... có thể ...”. Không khẳng định mưa chắc chắn tiếp tục, giờ lũ đến, độ sâu ngập, xác suất mưa hoặc cấp độ cảnh báo pháp lý khi chưa có nguồn phù hợp. Một trạm không đại diện toàn lưu vực. Chưa có radar, gió, mực nước, độ ẩm đất hoặc dự báo chính thức thì nêu rõ phần thiếu.
- Khi người dùng nêu giả định cường độ I trong thời lượng Δt, được tính P_bổ_sung = I × Δt. Phút đổi sang giờ bằng cách chia 60. Bắt buộc viết “nếu giữ nguyên tốc độ giả định”; đây là kịch bản tính toán, không phải dự báo khí tượng. Không tự lấy cường độ 5 phút nhân cho cả ngày.
- Khi phù hợp, gợi ý theo dõi mực nước và bản tin chính thức; tránh đi qua nước ngập hoặc dòng chảy xiết. Không yêu cầu đến sát sông, cống hay sườn dốc để kiểm tra.

2. TÍNH SỐ LẦN GẦU LẬT:
- Ưu tiên đếm số nhịp thực từ sự kiện đã lưu trong đúng khoảng người dùng hỏi:
  + totalTipsToday hoặc rainHistory.recordedTips: số nhịp ngày.
  + rainHistory.hourly: giờ đồng hồ trong ngày trạm.
  + rainHistory.periods: từng buổi.
  + rainWindows: 1, 3, 24 giờ trượt.
- Phân biệt giờ đồng hồ 14:00–15:00 với 60 phút vừa qua. Nêu múi giờ, khoảng tính và thời điểm chốt. Ngày khác hoặc khoảng chưa có dữ liệu thì nói thiếu, không thay bằng hôm nay. Khoảng chưa đến không phải 0 nhịp. Dữ liệu thiếu chỉ cho biết phần đã ghi nhận.
- Nếu chỉ có lượng mưa P (mm), dùng N_tương_đương = P / k với k (mm/tip) không đổi và lớn hơn 0. Hệ số người dùng cung cấp chỉ là giả định bài tính, không thay đổi cấu hình trạm. Thiếu k thì hỏi k, không mặc định 0.64. P phải không âm.
- Nếu N không nguyên, giữ kết quả tương đương và nêu số làm tròn riêng; không khẳng định đó là số nhịp thực. Nếu hệ số thay đổi, cộng nhịp từng sự kiện hoặc tính từng đoạn theo hệ số tương ứng; không chia toàn bộ lượng mưa lịch sử cho hệ số hiện tại. Chỉ có tổng mm và thiếu lịch sử hiệu chuẩn thì không xác định chắc chắn số nhịp thực.
- Nếu đầu vào là mm/h, cần thời lượng: P = I × Δt, rồi N_tương_đương = P / k. Không tự giả định thời lượng 1 giờ. Có thể đổi ngược P = N × k với N nguyên không âm.

3. CÁCH VIẾT:
- Trả lời tiếng Việt tự nhiên bằng 1–3 đoạn ngắn, nêu bằng chứng trước rồi nhận định có điều kiện. Không tự dựng số liệu. Tình huống do người dùng mô tả phải được ghi rõ nguồn: “Theo tình huống bạn mô tả...”. Các ví dụ dưới đây là giả định, không phải số đo hiện tại:
  + Ví dụ A: “Mưa lớn kéo dài thì sắp tới thế nào?”
    “Nếu mưa tiếp tục, lượng nước tích lũy có thể tăng và gây áp lực thoát nước; nơi thoát kém có thể ngập cục bộ. Tại lưu vực dốc hoặc đất đã bão hòa, nguy cơ lũ quét và sạt lở có thể tăng. Trạm chưa có dữ liệu mực nước, địa hình và độ ẩm đất để xác nhận các điều kiện đó; đây là kịch bản có điều kiện, chưa xác định mưa sẽ kéo dài bao lâu.”
  + Ví dụ B: “Giờ này đo 12.8 mm, k=0.64 mm/tip thì bao nhiêu lần?”
    “Theo số liệu bạn cung cấp, N = 12.8 / 0.64 = 20 lần tương đương, giả sử hệ số không đổi. Số nhịp thực cần đối chiếu sự kiện được lưu trong đúng giờ đó.”
  + Ví dụ C: “Ngày đo 32 mm, k=0.64 mm/tip?”
    “N_tương_đương = 32 / 0.64 = 50 lần. Nếu hệ số đã đổi trong ngày, cần đếm nhịp sự kiện thay vì suy ngược bằng hệ số hiện tại.”
  + Ví dụ D: “10 mm, k=0.64 mm/tip?”
    “10 / 0.64 = 15.625 lần tương đương; khoảng 16 lần nếu làm tròn. Chưa thể xác nhận số nhịp thực từ phép chia này.”
  + Ví dụ E: “Nếu 12.8 mm/h trong 30 phút, k=0.64?”
    “Nếu giữ nguyên tốc độ giả định trong 0.5 giờ, lượng mưa bổ sung là 12.8 × 0.5 = 6.4 mm, tương đương 6.4 / 0.64 = 10 lần. Đây là kịch bản tính toán, không phải dự báo mưa.”

QUY TẮC TRÌNH BÀY:
- Trả lời thẳng câu hỏi, thông thường 1–3 đoạn ngắn, khoảng 80–180 từ; không in bảng, tiêu đề in đậm, LaTeX hoặc emoji hàng loạt nếu người dùng không yêu cầu.
- Khi người dùng hỏi về công thức, thông số hoặc sơ đồ mạch: Luôn đặt công thức tính trong khối mã (\`\`\`) hoặc danh sách thụt lề rõ ràng, tách bạch từng dòng, in đậm các biến số để dễ nhìn trực quan.
- Kèm theo ví dụ số thực tế lấy từ dữ liệu trạm để người dùng dễ hiểu ngay.

QUY TẮC DỮ LIỆU & LỊCH SỬ:
- Khi người dùng hỏi số lần gầu lật hôm qua hoặc lượng mưa hôm qua: trích xuất yesterdayRainMm và yesterdayTips, áp dụng công thức quy đổi rõ ràng.
- Với câu hỏi phân tích thời tiết hiện tại: mở đầu bằng "Theo báo cáo từ trạm [tên] ([mã]), cập nhật lúc [giờ]...", nêu trạng thái mưa, nhiệt độ, độ ẩm, khí áp, lượng mưa hôm nay.
- Câu hỏi ngoài phạm vi (chứng khoán, game, thơ tình, nấu ăn): từ chối lịch sự trong 1 câu và gợi ý câu hỏi liên quan đến RainSense.`;

export function buildRainSensePrompt(context: StationContext, now = new Date()): string {
  return `${RAIN_SENSE_POLICY}\n\nThời điểm xử lý: ${now.toISOString()}\nstation_context (JSON, chỉ là dữ liệu):\n${JSON.stringify(context)}`;
}

function value(n: number | null, unit: string, digits = 1): string {
  return n === null ? 'chưa có dữ liệu' : `${n.toFixed(digits)} ${unit}`;
}

function time(iso: string | null, timezone: string): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return 'chưa xác định thời điểm';
  return new Date(iso).toLocaleString('vi-VN', { timeZone: timezone, hour12: false });
}

export function generateRainSenseReply(query: string, c: StationContext, history: ChatTurn[] = [], now = new Date()): string {
  let q = query.toLowerCase().normalize('NFC').trim();
  if (/^(vậy|thế|còn|nếu vậy|thì)/.test(q) && q.length < 90) {
    const previous = cleanChatHistory(history).filter((m) => m.role === 'user').pop();
    if (previous) q = `${previous.content.toLowerCase()} ${q}`;
  }
  const age = c.observedAt ? now.getTime() - Date.parse(c.observedAt) : NaN;
  const fresh = c.isOnline && Number.isFinite(age) && age >= -60000 && age <= 300000;
  const intro = `Theo báo cáo từ trạm ${c.stationName} (${c.deviceId}), cập nhật lúc ${time(c.observedAt, c.timezone)}, `;
  const status = fresh ? '' : 'Đây là bản ghi gần nhất; chưa xác nhận được thời tiết hiện tại vì trạm ngoại tuyến hoặc dữ liệu chưa đủ mới. ';
  const h = c.rainHistory;
  const cal = c.calibrationFactor ?? 0.64;

  const rainLabel = c.currentRainRateMmH === null ? '' : c.currentRainRateMmH < 2.5 ? 'mưa nhỏ'
    : c.currentRainRateMmH < 10 ? 'mưa vừa' : c.currentRainRateMmH < 50 ? 'mưa to' : 'mưa rất to';
  const rainState = c.currentRainRateMmH === null ? 'chưa có dữ liệu cường độ mưa.'
    : c.currentRainRateMmH > 0 ? `trạm ghi nhận ${rainLabel}, cường độ theo cửa sổ 5 phút là ${value(c.currentRainRateMmH, 'mm/h')}.`
    : 'chưa ghi nhận nhịp lật mới trong cửa sổ 5 phút của bản ghi; chưa thể khẳng định đã tạnh hoàn toàn.';
  const has = (pattern: RegExp) => pattern.test(q);

  // 0A. Hỏi ngày chưa có trong context (ngày mai, hôm kia, tuần trước...)
  if (has(/ngày mai|hôm kia|ngày kia|tuần trước|tháng trước|năm ngoái/) && has(/gầu|nhịp|lần|lật|tip|mưa/)) {
    return 'Trạm RainSense hiện chỉ lưu trữ dữ liệu của hôm nay và hôm qua trong bộ nhớ; chưa có dữ liệu quan trắc của ngày bạn hỏi để tính số nhịp gầu lật.';
  }

  // 0B. Hệ số hiệu chuẩn thay đổi giữa ngày
  if (has(/hệ số.*(đổi|thay đổi)|(đổi|thay đổi).*hệ số/)) {
    return 'Nếu hệ số hiệu chuẩn thay đổi trong ngày, cần cộng nhịp từng sự kiện hoặc tính từng đoạn theo hệ số tương ứng; không chia toàn bộ lượng mưa lịch sử cho hệ số hiện tại. Chỉ có tổng mm và thiếu lịch sử hiệu chuẩn thì không xác định chắc chắn số nhịp thực.';
  }

  // 0C. BME280 Độ ẩm không khí vs Độ ẩm đất / Bão hòa đất
  if (has(/độ ẩm.*(đất|bão hòa)|bão hòa.*(đất|độ ẩm)|bme280.*độ ẩm đất/)) {
    return 'Độ ẩm không khí từ cảm biến BME280 không phải là độ ẩm đất; độ ẩm không khí cao không đồng nghĩa đất đã bão hòa. Trạm RainSense chưa có cảm biến đo độ ẩm đất, cấu trúc địa mạo hay mực nước ngầm để xác nhận điều kiện bão hòa.';
  }

  // 0D. Mưa ngưng, cường độ = 0 thì hết nguy cơ chưa
  if (has(/(mưa ngưng|tạnh|cường độ.*0).*hết nguy cơ|nguy cơ.*(khi|sau khi).*(mưa ngưng|tạnh)|mưa ngưng.*nguy cơ/)) {
    return 'Nếu mưa ngưng hoặc cường độ tức thời bằng 0, chưa thể kết luận hết nguy cơ: nước từ thượng nguồn có thể tiếp tục đổ về gây ngập hoặc lũ muộn, và sườn dốc đã ngấm no nước vẫn có thể mất ổn định dẫn đến sạt lở. Cần tiếp tục theo dõi diễn biến dòng chảy và bản tin khí tượng thủy văn chính thức.';
  }

  // 0E. Telemetry thiếu, giờ hiện tại chưa đủ
  if (has(/(thiếu telemetry|telemetry thiếu|chưa đủ telemetry|giờ hiện tại chưa đủ|dữ liệu gián đoạn).*(xu hướng|số nhịp|nhịp lật|gầu)/)) {
    return 'Khi telemetry bị thiếu hoặc giờ quan trắc hiện tại chưa đủ trọn vẹn, không thể khẳng định chắc chắn xu hướng mưa đang tăng hay giảm, cũng như chưa xác định đủ số nhịp gầu lật. Dữ liệu ghi nhận chỉ cho biết phần đã thu thập được tại trạm.';
  }

  // 0F. Mưa lớn kéo dài, lượng mưa giờ tăng / Thiên tai (ngập úng, lũ quét, sạt lở)
  if (has(/(mưa lớn kéo dài|mưa kéo dài|lượng mưa giờ tăng|áp lực thoát nước|lũ quét|sạt lở|ngập cục bộ|nguy cơ.*thiên tai).*(sắp tới|thế nào|ảnh hưởng|sao)|mưa lớn kéo dài thì sắp tới thế nào|sắp tới thế nào.*mưa/)) {
    return 'Nếu mưa tiếp tục, lượng nước tích lũy có thể tăng và gây áp lực thoát nước; nơi thoát kém có thể ngập cục bộ. Tại lưu vực dốc hoặc đất đã bão hòa, nguy cơ lũ quét và sạt lở có thể tăng. Trạm chưa có dữ liệu mực nước, địa hình và độ ẩm đất để xác nhận các điều kiện đó; đây là kịch bản có điều kiện, chưa xác định mưa sẽ kéo dài bao lâu.';
  }

  // 0G. Bài toán giả định với cường độ mưa (mm/h) và thời lượng
  const rateMatch = q.match(/(\d+(?:\.\d+)?)\s*mm\s*\/\s*(?:h|giờ)/);
  if (rateMatch && (has(/lần|nhịp|gầu|tip|tương đương|bao nhiêu|bổ sung/) || has(/trong\s+\d+/))) {
    const I = parseFloat(rateMatch[1]);
    const minMatch = q.match(/(?:trong\s+)?(\d+(?:\.\d+)?)\s*(?:phút|mins?|p\b)/);
    const hourMatch = q.match(/(?:trong\s+)?(\d+(?:\.\d+)?)\s*(?:giờ|tiếng|h\b)(?!\s*[\/])/);

    if (!minMatch && !hourMatch) {
      return 'Cần cung cấp thêm thời lượng mưa (ví dụ: số phút hoặc số giờ) để tính lượng mưa tích lũy P = I × Δt trước khi quy đổi ra số nhịp gầu lật. Đơn vị cường độ mm/h là tốc độ tức thời, không thể dùng trực tiếp thay cho lượng mưa mm.';
    }

    const durationHours = minMatch ? parseFloat(minMatch[1]) / 60 : parseFloat(hourMatch![1]);
    const kMatch = q.match(/k\s*[:=]\s*(-?\d+(?:\.\d+)?)|(-?\d+(?:\.\d+)?)\s*mm\s*\/\s*tip|hệ số(?:\s*hiệu chuẩn)?\s*(?:là|bằng|=|:)?\s*(-?\d+(?:\.\d+)?)/);
    const rawK = kMatch ? (kMatch[1] ?? kMatch[2] ?? kMatch[3]) : null;
    const kVal = rawK !== null ? parseFloat(rawK) : null;

    if (kVal !== null && kVal <= 0) {
      return 'Hệ số hiệu chuẩn k phải là một số dương lớn hơn 0 (k > 0) để tính số lần gầu lật.';
    }
    if (kVal === null) {
      return 'Cần cung cấp hệ số hiệu chuẩn k (mm/tip) lớn hơn 0 để tính số nhịp gầu lật tương đương.';
    }

    const P = Math.round(I * durationHours * 1000) / 1000;
    const N = Math.round((P / kVal) * 1000) / 1000;
    const durStr = durationHours.toString();
    return `Nếu giữ nguyên tốc độ giả định trong ${durStr} giờ, lượng mưa bổ sung là ${I} × ${durStr} = ${P} mm, tương đương ${P} / ${kVal} = ${N} lần. Đây là kịch bản tính toán, không phải dự báo mưa.`;
  }

  // 0H. Bài toán tính số lần gầu lật từ lượng mưa P (mm)
  const pMatch = q.match(/(\d+(?:\.\d+)?)\s*mm(?!\s*\/\s*(?:h|giờ))/);
  const kMatch = q.match(/k\s*[:=]\s*(-?\d+(?:\.\d+)?)|(-?\d+(?:\.\d+)?)\s*mm\s*\/\s*tip|hệ số(?:\s*hiệu chuẩn)?\s*(?:là|bằng|=|:)?\s*(-?\d+(?:\.\d+)?)/);
  if (pMatch && (has(/lần|nhịp|gầu|tip|tương đương|bao nhiêu|mấy/) || kMatch)) {
    const P = parseFloat(pMatch[1]);
    const rawK = kMatch ? (kMatch[1] ?? kMatch[2] ?? kMatch[3]) : null;
    const kVal = rawK !== null ? parseFloat(rawK) : null;

    if (kVal !== null && kVal <= 0) {
      return 'Hệ số hiệu chuẩn k phải là một số dương lớn hơn 0 (k > 0) để tính số lần gầu lật.';
    }

    if (kVal !== null) {
      const N = P / kVal;
      const isInteger = Math.abs(N - Math.round(N)) < 1e-5;
      if (isInteger) {
        const nInt = Math.round(N);
        if (has(/ngày/)) {
          return `N_tương_đương = ${P} / ${kVal} = ${nInt} lần. Nếu hệ số đã đổi trong ngày, cần đếm nhịp sự kiện thay vì suy ngược bằng hệ số hiện tại.`;
        }
        return `Theo số liệu bạn cung cấp, N = ${P} / ${kVal} = ${nInt} lần tương đương, giả sử hệ số không đổi. Số nhịp thực cần đối chiếu sự kiện được lưu trong đúng giờ đó.`;
      } else {
        const roundedN = Math.round(N);
        return `${P} / ${kVal} = ${parseFloat(N.toFixed(4))} lần tương đương; khoảng ${roundedN} lần nếu làm tròn. Chưa thể xác nhận số nhịp thực từ phép chia này.`;
      }
    } else if (!has(/hôm nay|hôm qua|hiện tại|trạm/)) {
      return 'Cần cung cấp hệ số hiệu chuẩn k (mm/tip) lớn hơn 0 để tính số lần gầu lật tương đương (N = P / k); trạm không tự giả định hệ số cho các bài tính toán tùy ý.';
    }
  }

  // 1. Dự báo thời tiết, khi nào mưa, xác suất mưa, chiều mai mưa mấy giờ
  if (has(/(mai|sắp|tiếp|lát|chiều|tối).*(chắc|dự báo|bao giờ|mấy giờ|có mưa|mưa không)|dự báo|xác suất|khi nào.*mưa/)) {
    return `${intro}${rainState} ${status}Dữ liệu RainSense chưa đủ để dự báo chính xác giờ mưa, xác suất mưa hoặc khẳng định đợt tiếp theo. Có thể theo dõi nhịp gầu và các bản tin tiếp theo, kết hợp dự báo khí tượng chính thức cho khu vực.`;
  }

  // 2. Sơ đồ mạch, nối chân, phần cứng, GPIO, linh kiện
  if (has(/mạch|sơ đồ|nối chân|đấu nối|pinout|gpio|linh kiện|phần cứng|hardware|kết nối.*(chân|cảm biến|esp32)|(esp32|bme280|a3144|oled).*chân/)) {
    return `Sơ đồ kết nối phần cứng và mạch điện trạm **ESP32-S3 RainSense**:

| Linh kiện | Chân linh kiện | Chân ESP32-S3 | Chức năng kỹ thuật |
|---|---|---|---|
| **Cảm biến Hall A3144** | VCC | 3V3 | Nguồn 3.3V ổn định |
| | GND | GND | Nối mass chung |
| | OUT | GPIO 10 | Ngắt FALLING, INPUT_PULLUP, Debounce 200ms |
| **Cảm biến BME280** | VCC | 3V3 | Nguồn 3.3V (Tuyệt đối không cấp 5V) |
| | GND | GND | Nối mass chung |
| | SDA | GPIO 8 | I2C Data bus |
| | SCL | GPIO 9 | I2C Clock bus (100 kHz) |
| **Màn hình OLED SH1106** | VCC / GND | 3V3 / GND | Nguồn cấp 3.3V |
| | SDA / SCL | GPIO 8 / GPIO 9 | Chung bus I2C với BME280 |
| **Nút Reset mưa phần cứng** | Nút BOOT | GPIO 0 | Nhấn để reset bộ đếm mưa về 0.00 mm |
| **Khối nguồn nuôi trạm** | Type-C / 5V | Chân 5V / VBUS | LDO hạ áp 3.3V (AMS1117), Pin 18650 + sạc TP4056 |

💡 **Lưu ý kỹ thuật:** BME280 và OLED chạy điện áp logic 3.3V. Chân GPIO 10 của cảm biến Hall đã được kích hoạt điện trở kéo lên nội (internal pull-up) trong firmware.`;
  }

  // 2. Điểm sương, chỉ số nhiệt, biến thiên áp suất (công thức khí tượng chuyên sâu)
  if (has(/điểm sương|dew point|chỉ số nhiệt|heat index|magnus|rothfusz|biến thiên.*(khí áp|áp suất)/)) {
    return `Các công thức khí tượng chuyên sâu tích hợp trong trạm RainSense:

📐 **CÔNG THỨC KHÍ TƯỢNG:**
\`\`\`
• Điểm sương Magnus-Tetens (Dew Point - °C):
  α(T, RH) = (17.27 × T) / (237.7 + T) + ln(RH / 100)
  Điểm sương Td = (237.7 × α) / (17.27 - α)

• Chỉ số nhiệt cảm nhận (Heat Index - Rothfusz):
  Đánh giá độ oi bức kết hợp giữa nhiệt độ khô T và độ ẩm RH

• Biến thiên áp suất khí quyển (Barometric Tendency):
  ΔP / 3 giờ ≤ -3.0 hPa → Dấu hiệu bão, dông lốc, rãnh áp thấp
\`\`\`

📊 **Chỉ số đo đạc thực tế từ trạm ${c.deviceId}:**
• Nhiệt độ: ${value(c.currentTemp, '°C')} | Độ ẩm: ${value(c.currentHumid, '%')}
• Điểm sương: **${value(c.dewPoint, '°C')}**
• Nhiệt cảm nhận: **${value(c.heatIndex, '°C')}**
• Áp suất: **${value(c.currentPress, 'hPa')}** (Xu hướng: ${c.pressureTrend})`;
  }

  // 3. Số lần lật gầu hoặc lượng mưa ngày hôm qua
  if (has(/hôm qua|hôm trc|hôm trước|ngày trước|yesterday/) && has(/gầu|lật|nhịp|tip|mưa|tính/)) {
    const yMm = typeof c.yesterdayRainMm === 'number' ? c.yesterdayRainMm : null;
    const yTips = typeof c.yesterdayTips === 'number'
      ? c.yesterdayTips
      : yMm !== null && cal > 0 ? Math.round(yMm / cal) : null;

    return `Dữ liệu ghi nhận từ trạm ${c.stationName} (${c.deviceId}) cho ngày hôm qua:

• **Lượng mưa ghi nhận hôm qua:** ${yMm !== null ? `${yMm.toFixed(2)} mm` : 'Chưa có bản ghi lưu trữ'}
• **Số lần gầu lật ước tính:** ${yTips !== null ? `${yTips} nhịp lật (tips)` : 'Chưa đủ dữ liệu nhịp lật'}
• **Hệ số hiệu chuẩn:** ${cal} mm/tip

📐 **CÔNG THỨC QUY ĐỔI SỐ LẦN GẦU LẬT:**
\`\`\`
• Số nhịp lật (Tips) = Lượng mưa (mm) / Hệ số hiệu chuẩn (mm/tip)
• Lượng mưa (mm) = Số nhịp lật (Tips) × Hệ số hiệu chuẩn (mm/tip)
\`\`\`
${yMm !== null && yTips !== null ? `*Ví dụ thực tế hôm qua: ${yMm.toFixed(2)} mm / ${cal} mm/tip = ${yTips} nhịp lật.*` : ''}

*(Hôm nay trạm đã ghi nhận **${c.totalTipsToday ?? 0} nhịp lật**, tương ứng lượng mưa tích lũy **${value(c.todayRainMm, 'mm', 2)}**).*`;
  }

  // 4. Nguyên lý và công thức tính lượng mưa gầu lật Hall A3144
  if (
    has(/công thức.*(gầu|mưa|a3144|lật)/) ||
    has(/cách gầu.*(tính|đo|hoạt động)/) ||
    has(/nguyên lý.*(gầu|mưa)/) ||
    has(/a3144|hall|mm\/h|hiệu chuẩn/)
  ) {
    return `Hệ thống đo mưa RainSense hoạt động dựa trên cơ cấu **gầu lật đôi kết hợp cảm biến từ Hall A3144**:

🌧️ **1. Nguyên lý cơ điện tử:**
Nước mưa rơi vào phễu chuẩn hứng chảy xuống gầu bập bênh. Khi lượng nước đạt mức cân bằng (${cal} mm), gầu nghiêng để đổ nước qua lỗ thoát đáy, đồng thời nam châm Neodymium gắn trên gầu quét qua IC Hall A3144, kích hoạt xung ngắt mức thấp (FALLING) trên chân **GPIO 10** của ESP32-S3 (có bộ lọc chống dội debounce 200ms).

📐 **2. Công thức tính toán chuẩn:**
\`\`\`
• Lượng mưa tích lũy:
  Lượng mưa (mm) = Số nhịp lật (Tips) × Hệ số hiệu chuẩn (mm/tip)

• Quy đổi số lần gầu lật:
  Số nhịp lật (Tips) = Lượng mưa (mm) / Hệ số hiệu chuẩn (mm/tip)

• Cường độ mưa tức thời (Rain Rate theo cửa sổ 5 phút):
  Cường độ (mm/h) = Lượng mưa trong 5 phút (mm) × 12
\`\`\`

📊 **3. Thông số thực tế tại trạm ${c.deviceId}:**
• Hệ số cấu hình hiện tại: **${cal} mm/tip**
• Số lần lật hôm nay: **${c.totalTipsToday ?? 0} nhịp** → Tích lũy: **${value(c.todayRainMm, 'mm', 2)}**
• Cường độ tức thời hiện tại: **${value(c.currentRainRateMmH, 'mm/h')}**`;
  }

  // 5. Thống kê số lần lật gầu hôm nay / tổng quát
  if (
    has(/(tính|bao nhiêu|mấy).*(lần|nhịp|gầu|tip)/) ||
    has(/gầu.*(hôm nay|bao nhiêu|tính|lật)/) ||
    has(/hôm nay.*(lần lật|nhịp lật|gầu lật|mấy lần|mấy nhịp|bao nhiêu tip|tips)/) ||
    has(/số (lần|nhịp|tip).*gầu/)
  ) {
    return `Thống kê số lần lật gầu tại trạm ${c.stationName} (${c.deviceId}):

• **Số nhịp lật hôm nay (từ 00:00, múi giờ ${c.timezone}):** **${c.totalTipsToday ?? 0} nhịp lật (tips)**
• **Lượng mưa tích lũy hôm nay:** **${value(c.todayRainMm, 'mm', 2)}**
• **Hệ số hiệu chuẩn hiện tại:** **${cal} mm/tip**
${typeof c.yesterdayRainMm === 'number' ? `• **Ngày hôm qua:** ${c.yesterdayRainMm.toFixed(2)} mm (${c.yesterdayTips ?? Math.round(c.yesterdayRainMm / cal)} nhịp lật)` : ''}

📐 **CÔNG THỨC TÍNH TOÁN:**
\`\`\`
• Lượng mưa tích lũy:
  Lượng mưa (mm) = Số nhịp lật (Tips) × Hệ số hiệu chuẩn (mm/tip)

• Quy đổi số lần gầu lật:
  Số nhịp lật (Tips) = Lượng mưa (mm) / Hệ số hiệu chuẩn (mm/tip)

• Cường độ mưa tức thời:
  Cường độ (mm/h) = Lượng mưa trong 5 phút (mm) × 12
\`\`\`
*Mỗi nhịp gầu lật gửi tín hiệu ngắt về ESP32-S3 tương ứng với ${cal} mm nước mưa.*`;
  }

  // 6. Diễn biến mưa ngưng rồi mưa lại
  if (has(/mưa|gầu|nhịp/) && has(/ngưng|ngừng|tạnh|gián đoạn|từng đợt|mưa lại|lúc.*lúc/)) {
    const recorded = h && h.episodes.length > 1
      ? `Lịch sử có ${h.episodes.length} nhóm nhịp mưa (tách theo khoảng cách trên 20 phút). ` + h.gaps.slice(-3).map((g) =>
        `Từ ${time(g.from, c.timezone)} đến ${time(g.to, c.timezone)}, ${g.telemetryComplete ? `không ghi nhận nhịp mới trong khoảng ${g.minutes} phút; đây là khoảng tạm ngưng ghi nhận, chưa xác nhận tạnh hoàn toàn` : 'telemetry gián đoạn nên chưa thể xác nhận khoảng tạm ngưng mưa'}.`
      ).join(' ')
      : 'Theo tình huống bạn mô tả, mưa có thể diễn ra thành nhiều đợt. Chưa đủ lịch sử để xác nhận các mốc ngưng và mưa lại tại trạm.';
    return `${recorded}\n\nLượng mưa ngày tiếp tục cộng dồn qua các đợt: lúc không có nhịp mới tổng giữ nguyên, khi mưa lại tổng tăng tiếp, không tự về 0. Cường độ 5 phút giảm hoặc về 0 sau khi các nhịp cũ rời cửa sổ rồi tăng khi có nhịp mới. Mốc nhịp đầu/cuối không phải giờ bắt đầu/kết thúc mưa chính xác. ${status}`;
  }

  // 7. So sánh mưa sáng và chiều
  if (has(/mưa|lượng|buổi/) && has(/sáng|chiều|từng giờ|theo giờ|diễn biến|lịch sử|so sánh/)) {
    if (!h) return 'Theo tình huống bạn mô tả, sáng mưa nhiều và chiều mưa ít thì tổng lượng mưa ngày vẫn tăng, nhưng mức tăng từng buổi khác nhau. Chưa có lịch sử mưa theo thời gian để xác nhận tại trạm hoặc đưa ra số mm từng buổi. Cần so sánh lượng mưa 06:00–12:00 và 12:00–18:00 theo giờ trạm; tổng mm không đồng nghĩa cường độ đỉnh mm/h.';
    const periods = h.periods.filter((p) => /Sáng|Chiều/.test(p.label));
    return `Theo lịch sử ghi nhận từ trạm ${c.stationName} (${c.deviceId}), ${periods.map((p) => !p.elapsed
      ? `${p.label.toLowerCase()} chưa đến thời gian quan trắc`
      : `${p.label.toLowerCase()} ghi nhận ${value(p.rainfallMm, 'mm', 2)}${p.complete ? '' : ' (dữ liệu chưa phủ đủ buổi)'}`).join('; ')}.\n\n${h.coverageComplete ? '' : 'Lịch sử còn thiếu hoặc gián đoạn; đây chỉ là phần đã ghi nhận. '}Nếu buổi chiều chưa kết thúc, chỉ so sánh đến thời điểm cập nhật. Tổng mm từng buổi không cho biết cường độ đỉnh, không bảo đảm chiều tối hết mưa. ${status}`;
  }

  // 8. Reset, bộ đếm về 0, giảm lượng mưa
  if (has(/reset|về 0|giảm.*(tổng|lượng)|(?:tổng|lượng).*giảm|không lật|không tăng|bất thường|sai số/)) {
    return 'Lượng mưa tích lũy của cùng một ngày và cùng cách tính thường không giảm khi mưa tạm ngưng. Cần đối chiếu thời điểm sang ngày mới, lệnh reset, số đếm trên ESP32-S3, cấu hình hiệu chuẩn và sự kiện đã lưu. Mưa rất nhỏ có thể chưa đủ nước để lật gầu; cũng cần kiểm tra phễu, cơ cấu gầu và đường tín hiệu. Chưa đủ bằng chứng để kết luận nguyên nhân cụ thể; không xóa lượng mưa đã lưu chỉ vì bộ đếm thiết bị về 0.';
  }

  // 9. Mất mạng, ngoại tuyến
  if (has(/mất mạng|offline|ngoại tuyến|mất kết nối|không nhận|lỗi.*(trạm|mqtt|cảm biến)/)) {
    return `Trạm ${c.deviceId} có bản đo gần nhất lúc ${time(c.observedAt, c.timezone)}. Trong khoảng mất kết nối, không thể coi việc thiếu nhịp mưa là không mưa. Kiểm tra nguồn ESP32-S3, Wi-Fi, kết nối MQTT và log thiết bị; khi kết nối lại cần đối chiếu telemetry với sự kiện gầu đã lưu, tránh cộng trùng.`;
  }

  // 10. Khí áp, bão, áp suất, giông sét, độ ẩm
  if (has(/khí áp|áp suất|bão|giông|dông|sét|ngập|độ ẩm.*(mưa|chắc)/)) {
    return `${intro}khí áp ghi nhận ${value(c.currentPress, 'hPa')}, độ ẩm ${value(c.currentHumid, '%')}. ${status}Một giá trị khí áp hoặc độ ẩm cao riêng lẻ không đủ kết luận sắp mưa, bão, dông sét hay ngập. Cần chuỗi đo theo thời gian và nguồn khí tượng bổ sung; RainSense chưa có cảm biến gió, sét hay mực nước để xác nhận các hiện tượng đó.`;
  }

  // 11. Firmware, MQTT, Topic, Backend, CSDL
  if (has(/firmware|arduino|wifi|preferences|flash|nvs|mqtt|broker|emqx|hivemq|tls|topic|postgres|prisma|express|nextjs|backend|frontend|kiến trúc/)) {
    return `Kiến trúc hệ thống IoT hoàn chỉnh của đồ án RainSense:

📡 **1. Giao thức MQTT TLS (Port 8883) qua EMQX / HiveMQ Cloud:**
• \`weather/${c.deviceId}/telemetry\`: Gửi nhiệt độ, độ ẩm, khí áp, điểm sương định kỳ 30s.
• \`weather/${c.deviceId}/rain\`: Gửi sự kiện nhịp gầu lật tức thời (tipCount, durationMs, instantRate).
• \`weather/${c.deviceId}/status\`: Báo trạng thái trực tuyến / ngoại tuyến (LWT).
• \`weather/${c.deviceId}/command\` & \`/command/ack\`: Gửi và phản hồi lệnh từ Dashboard (reset mưa, đổi chu kỳ).

⚙️ **2. Firmware vi điều khiển (ESP32-S3):**
• File mã nguồn: \`firmware/RainSense_ESP32S3/RainSense_ESP32S3.ino\`
• Tích hợp WiFiMulti tự phục hồi mạng, Preferences Flash chống mất số đếm khi mất điện.

💻 **3. Nền tảng Server & Giao diện:**
• Backend: Node.js Express + Socket.IO (real-time) + Prisma ORM + PostgreSQL (Aiven Cloud).
• Frontend: Next.js 14 App Router + Tailwind CSS + Recharts hiển thị đồ thị và cảnh báo ngập.`;
  }

  // 12. Thời tiết, phân tích mưa, hiện tại, hôm nay
  if (has(/thời tiết|phân tích.*mưa|hiện tại|tổng quan|hôm nay.*mưa|mưa.*hôm nay|nhiệt độ|độ ẩm|lượng mưa|đang mưa|mưa.*(nhiều|ít|to|nhỏ)/)) {
    if (c.currentTemp === null && c.currentHumid === null && c.currentPress === null && c.todayRainMm === null) {
      return `Trạm ${c.stationName} (${c.deviceId}) chưa có báo cáo quan trắc để phân tích thời tiết hiện tại. Chưa thể xác nhận có mưa hay không; cần kiểm tra kết nối trạm và chờ bản tin đo mới.`;
    }
    return `${intro}${rainState} ${status}\n\nNhiệt độ ${value(c.currentTemp, '°C')}, độ ẩm ${value(c.currentHumid, '%')}, khí áp ${value(c.currentPress, 'hPa')}. Lượng mưa ghi nhận hôm nay là ${value(c.todayRainMm, 'mm', 2)}${h && !h.coverageComplete ? ' (lịch sử chưa phủ đủ từ đầu ngày)' : ''}. Tổng mưa ngày cho biết lượng tích lũy, không cho biết hiện giờ có mưa to hay không.`;
  }

  // 13. Áo mưa, ra ngoài, chuẩn bị
  if (has(/áo mưa|ra ngoài|đi học|đi làm|phơi|tưới|đặt trạm|vị trí/)) {
    return `${intro}${rainState} ${status}Với hoạt động ngoài trời, có thể chuẩn bị đồ che mưa và theo dõi bản tin mới. Trạm chỉ phản ánh vị trí đặt cảm biến, chưa đủ để khẳng định điều kiện trên toàn tuyến đường hoặc trong các giờ tới.`;
  }

  // 14. Chào hỏi
  if (has(/^(xin chào|chào|hello|hi|hey)[! .?]*$|bạn là ai|làm được gì|có thể làm gì|cảm ơn/)) {
    return `Mình là **RainSense AI** 🌧️, hỗ trợ toàn diện các thông tin về trạm quan trắc RainSense:
• 📊 Phân tích thời tiết vi khí hậu thời gian thực (BME280: Nhiệt độ, độ ẩm, khí áp).
• 🌧️ Đo mưa gầu lật Hall A3144: Công thức tính lượng mưa, số lần lật hôm nay và hôm qua.
• 🛠️ Kỹ thuật phần cứng IoT: Sơ đồ nối chân ESP32-S3, firmware, MQTT TLS và cơ sở dữ liệu.

Bạn cần mình tra cứu dữ liệu thời tiết hay giải đáp kỹ thuật nào?`;
  }

  // 15. Từ chối câu hỏi ngoài phạm vi
  return 'Mình hỗ trợ trong phạm vi dự án RainSense (dữ liệu vi khí hậu, gầu lật Hall A3144, mạch ESP32-S3, MQTT và phần mềm). Bạn có thể hỏi về lượng mưa, số lần lật gầu hôm qua/hôm nay, sơ đồ nối chân hoặc cách vận hành trạm.';
}

/**
 * Computes rain history (periods, episodes, gaps, coverage) from stored events and telemetry.
 */
export function computeRainHistory(params: {
  events: RainEventRecordInput[];
  measurements?: TelemetryRecordInput[];
  timezone?: string;
  now?: Date;
  mqttIntervalSeconds?: number;
  defaultCalibration?: number;
}): RainHistory {
  const now = params.now ?? new Date();
  const timezone = params.timezone || 'Asia/Ho_Chi_Minh';
  const defaultCal = params.defaultCalibration ?? 0.64;
  const maxGapMs = Math.max(120, 3 * (params.mqttIntervalSeconds ?? 30)) * 1000;

  // Calculate start of day in timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find((p) => p.type === 'year')?.value || '1970', 10);
  const month = parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10);
  const day = parseInt(parts.find((p) => p.type === 'day')?.value || '1', 10);
  const offsetHours = timezone === 'Asia/Ho_Chi_Minh' ? 7 : 0;
  const startOfDay = new Date(Date.UTC(year, month - 1, day, -offsetHours, 0, 0, 0));

  const fromIso = startOfDay.toISOString();
  const toIso = now.toISOString();

  // Filter events of today up to now
  const dayEvents = (params.events || [])
    .map((e) => ({
      time: new Date(e.timestamp).getTime(),
      tips: e.tipCount,
      cal: e.calibrationFactor && e.calibrationFactor > 0 ? e.calibrationFactor : defaultCal
    }))
    .filter((e) => Number.isFinite(e.time) && e.time >= startOfDay.getTime() && e.time <= now.getTime())
    .sort((a, b) => a.time - b.time);

  // Measurements
  const measurements = (params.measurements || [])
    .map((m) => new Date(m.timestamp).getTime())
    .filter((t) => Number.isFinite(t) && t >= startOfDay.getTime() && t <= now.getTime())
    .sort((a, b) => a - b);

  // Check telemetry continuity in [fromTime, toTime]
  function isTelemetryContinuous(fromTime: number, toTime: number): boolean {
    if (toTime <= fromTime) return true;
    if (toTime - fromTime < maxGapMs) return true;
    if (measurements.length === 0) return false;

    const inRange = measurements.filter((t) => t >= fromTime - 30000 && t <= toTime + 30000);
    if (inRange.length === 0) return false;

    if (inRange[0] - fromTime > maxGapMs) return false;
    for (let i = 0; i < inRange.length - 1; i++) {
      if (inRange[i + 1] - inRange[i] > maxGapMs) return false;
    }
    if (toTime - inRange[inRange.length - 1] > maxGapMs) return false;

    return true;
  }

  const coverageComplete = isTelemetryContinuous(startOfDay.getTime(), now.getTime());

  let recordedTotalMm = 0;
  for (const e of dayEvents) {
    recordedTotalMm += e.tips * e.cal;
  }
  recordedTotalMm = Math.round(recordedTotalMm * 100) / 100;

  const periodDefs = [
    { label: 'Đêm', startH: 0, endH: 6 },
    { label: 'Sáng', startH: 6, endH: 12 },
    { label: 'Chiều', startH: 12, endH: 18 },
    { label: 'Tối', startH: 18, endH: 24 }
  ];

  const periods = periodDefs.map((p) => {
    const pStart = new Date(startOfDay.getTime() + p.startH * 3600 * 1000);
    const pEnd = new Date(startOfDay.getTime() + p.endH * 3600 * 1000);
    const elapsed = now.getTime() >= pStart.getTime();
    const isPast = now.getTime() >= pEnd.getTime();

    let rainfallMm = 0;
    if (elapsed) {
      const pEvents = dayEvents.filter((e) => e.time >= pStart.getTime() && e.time < pEnd.getTime());
      for (const pe of pEvents) {
        rainfallMm += pe.tips * pe.cal;
      }
    }
    rainfallMm = Math.round(rainfallMm * 100) / 100;

    const observedWindowEnd = Math.min(now.getTime(), pEnd.getTime());
    const telemOk = elapsed && isTelemetryContinuous(pStart.getTime(), observedWindowEnd);
    const complete = isPast && telemOk;

    return {
      label: p.label,
      from: pStart.toISOString(),
      to: pEnd.toISOString(),
      rainfallMm,
      complete,
      elapsed
    };
  });

  const episodes: Array<{ from: string; to: string; rainfallMm: number }> = [];
  const gaps: Array<{ from: string; to: string; minutes: number; telemetryComplete: boolean }> = [];

  if (dayEvents.length > 0) {
    let epStart = dayEvents[0].time;
    let epEnd = dayEvents[0].time;
    let epMm = dayEvents[0].tips * dayEvents[0].cal;

    for (let i = 1; i < dayEvents.length; i++) {
      const ev = dayEvents[i];
      if (ev.time - epEnd <= 20 * 60 * 1000) {
        epEnd = ev.time;
        epMm += ev.tips * ev.cal;
      } else {
        episodes.push({
          from: new Date(epStart).toISOString(),
          to: new Date(epEnd).toISOString(),
          rainfallMm: Math.round(epMm * 100) / 100
        });
        const gapMins = Math.round((ev.time - epEnd) / 60000);
        gaps.push({
          from: new Date(epEnd).toISOString(),
          to: new Date(ev.time).toISOString(),
          minutes: gapMins,
          telemetryComplete: isTelemetryContinuous(epEnd, ev.time)
        });

        epStart = ev.time;
        epEnd = ev.time;
        epMm = ev.tips * ev.cal;
      }
    }
    episodes.push({
      from: new Date(epStart).toISOString(),
      to: new Date(epEnd).toISOString(),
      rainfallMm: Math.round(epMm * 100) / 100
    });

    if (now.getTime() - epEnd > 20 * 60 * 1000) {
      const gapMins = Math.round((now.getTime() - epEnd) / 60000);
      gaps.push({
        from: new Date(epEnd).toISOString(),
        to: now.toISOString(),
        minutes: gapMins,
        telemetryComplete: isTelemetryContinuous(epEnd, now.getTime())
      });
    }
  }

  return {
    timezone,
    from: fromIso,
    to: toIso,
    coverageComplete,
    recordedTotalMm,
    periods,
    episodes,
    gaps
  };
}
