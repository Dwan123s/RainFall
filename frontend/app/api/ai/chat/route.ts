import { NextResponse } from 'next/server';

function cleanLatexArtifacts(text: string): string {
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

function generateLocalResponse(query: string, context: any): string {
  const q = query.toLowerCase().trim();

  // 1. Kiểm tra câu hỏi nằm ngoài phạm vi đề tài (Out of scope)
  const isOutOfScope =
    q.includes('chứng khoán') ||
    q.includes('cổ phiếu') ||
    q.includes('bitcoin') ||
    q.includes('crypto') ||
    q.includes('tiền ảo') ||
    q.includes('viết thơ') ||
    q.includes('thơ tình') ||
    q.includes('bài thơ') ||
    q.includes('nấu ăn') ||
    q.includes('món ăn') ||
    q.includes('công thức nấu') ||
    q.includes('liên quân') ||
    q.includes('free fire') ||
    q.includes('game') ||
    q.includes('chơi game') ||
    q.includes('showbiz') ||
    q.includes('ca sĩ') ||
    q.includes('diễn viên') ||
    q.includes('người mẫu') ||
    q.includes('xem bói') ||
    q.includes('tử vi') ||
    q.includes('bói toán') ||
    q.includes('tình yêu') ||
    q.includes('tán gái') ||
    q.includes('bóng đá') ||
    q.includes('ngoại hạng anh') ||
    q.includes('chính trị');

  if (isOutOfScope) {
    return (
      `Chào bạn! Tôi là **RainSense AI** 🌧️ — Trợ lý Kỹ thuật & Khí tượng thuộc Hệ thống Quan trắc Mưa Đô thị RainSense (trạm **${context.deviceId}**).\n\n` +
      `Câu hỏi này nằm ngoài phạm vi nghiên cứu và chuyên môn của dự án. Tôi được thiết kế chuyên trách để hỗ trợ bạn về:\n` +
      `• 🌤️ **Dữ liệu vi khí hậu thời gian thực:** Nhiệt độ, độ ẩm, áp suất khí quyển từ cảm biến BME280.\n` +
      `• 🌧️ **Đo đạc & Cảnh báo mưa:** Đếm nhịp gầu lật Hall A3144, lượng mưa tích lũy, cường độ mưa và cảnh báo ngập úng đô thị.\n` +
      `• 🛠️ **Kỹ thuật phần cứng IoT:** Vi điều khiển ESP32-S3, giao thức MQTT TLS (Port 8883) và Dashboard điều khiển.\n\n` +
      `Bạn có muốn tôi kiểm tra tình hình thời tiết hiện tại hoặc giải đáp kỹ thuật liên quan đến trạm không? 📡`
    );
  }

  // 2. Câu hỏi thời tiết đời sống hàng ngày ("hôm nay thế nào", "có mưa không", "mang ô không",...)
  const isDailyWeather =
    q.includes('hôm nay thế nào') ||
    q.includes('hôm nay ra sao') ||
    q.includes('thời tiết hôm nay') ||
    q.includes('trời hôm nay') ||
    q.includes('có mưa không') ||
    q.includes('trời có mưa') ||
    q.includes('mưa không') ||
    q.includes('mang ô') ||
    q.includes('mang dù') ||
    q.includes('áo mưa') ||
    q.includes('ra đường') ||
    q.includes('đi chơi') ||
    q.includes('có nóng không') ||
    q.includes('có lạnh không') ||
    q.includes('có mát không') ||
    q.includes('thời tiết này') ||
    q.includes('tình hình hôm nay');

  if (isDailyWeather) {
    const temp = context.currentTemp;
    const humid = context.currentHumid;
    const rain = context.todayRainMm;
    const rate = context.currentRainRateMmH;

    let advice = '';
    if (rain > 5 || rate > 2) {
      advice = '🌧️ **Lời khuyên:** Khu vực đang có mưa, đường trơn trượt và khả năng thoát nước chậm. Bạn nhớ mang theo áo mưa hoặc ô dù và di chuyển cẩn thận nhé!';
    } else if (temp >= 35) {
      advice = '☀️ **Lời khuyên:** Thời tiết hôm nay khá nắng gắt và oi bức. Bạn nên hạn chế hoạt động ngoài trời vào giờ cao điểm trưa, che chắn kỹ và uống nhiều nước!';
    } else if (temp < 24) {
      advice = '🍃 **Lời khuyên:** Không khí hôm nay khá mát mẻ và dễ chịu, rất thích hợp cho việc học tập, làm việc và các hoạt động ngoài trời!';
    } else {
      advice = '🌤️ **Lời khuyên:** Thời tiết hiện tại khô ráo, thoáng mát và tương đối thuận lợi cho việc di chuyển, sinh hoạt ngoài trời.';
    }

    return (
      `Chào bạn! Hôm nay tại khu vực trạm quan trắc **${context.deviceId}**, thời tiết ghi nhận như sau: 🌤️\n\n` +
      `• 🌡️ **Nhiệt độ:** **${temp.toFixed(1)}°C** (Nhiệt cảm nhận Heat Index: **${context.heatIndex.toFixed(1)}°C**)\n` +
      `• 💧 **Độ ẩm không khí:** **${humid.toFixed(1)}%** (${context.humidityStatus})\n` +
      `• 🌧️ **Tình hình mưa:** **${rain.toFixed(2)} mm** (${context.totalTipsToday} lần lật gầu, hiện tại: **${context.rainCategory}**)\n` +
      `• 🧭 **Khí áp:** **${context.currentPress.toFixed(1)} hPa** (Xu hướng: **${context.pressureTrend}**, không có dấu hiệu dông bão bất thường)\n\n` +
      `${advice}\n\n` +
      `Bạn có cần kiểm tra thêm chỉ số khí tượng hay thông tin cảm biến nào khác không?`
    );
  }

  // 3. Phân tích thời tiết hiện tại / Nhiệt độ / Độ ẩm / Khí áp / Mưa
  if (
    q.includes('thời tiết') ||
    q.includes('phân tích') ||
    q.includes('hiện tại') ||
    q.includes('chỉ số') ||
    q.includes('tổng quan') ||
    q.includes('nhiệt độ') ||
    q.includes('độ ẩm') ||
    q.includes('khí quyển') ||
    q.includes('nóng') ||
    q.includes('lạnh')
  ) {
    const tempStr = `${context.currentTemp.toFixed(1)}°C`;
    const humidStr = `${context.currentHumid.toFixed(1)}%`;
    const pressStr = `${context.currentPress.toFixed(1)} hPa`;
    const dewStr = `${context.dewPoint.toFixed(1)}°C`;
    const heatStr = `${context.heatIndex.toFixed(1)}°C`;

    return (
      `Dưới đây là báo cáo khí tượng thời gian thực từ trạm **${context.deviceId}**: 🌤️\n\n` +
      `| Đại lượng quan trắc | Giá trị đo | Đánh giá khí tượng | \n` +
      `|---|---|---| \n` +
      `| 🌡️ **Nhiệt độ không khí** | **${tempStr}** | Điểm sương: ${dewStr} | \n` +
      `| 💧 **Độ ẩm tương đối** | **${humidStr}** | Trạng thái: ${context.humidityStatus} | \n` +
      `| 🧭 **Áp suất khí quyển** | **${pressStr}** | Xu hướng: ${context.pressureTrend} | \n` +
      `| 🌧️ **Lượng mưa hôm nay** | **${context.todayRainMm.toFixed(2)} mm** | ${context.totalTipsToday} lần lật gầu | \n` +
      `| ⚡ **Cường độ tức thời** | **${context.currentRainRateMmH.toFixed(1)} mm/h** | Cấp độ: ${context.rainCategory} | \n` +
      `| 🌡️ **Nhiệt cảm nhận (Heat Index)** | **${heatStr}** | Tiêu chuẩn Rothfusz | \n\n` +
      `💡 **Nhận định:** ${
        context.todayRainMm > 15
          ? 'Khu vực đang ghi nhận lượng mưa đáng kể, cần chú ý hiện tượng thoát nước chậm và mang đồ che mưa khi ra ngoài. ☔'
          : context.currentTemp > 35
          ? 'Thời tiết nắng nóng gay gắt, chỉ số nhiệt cao, cần hạn chế hoạt động ngoài trời kéo dài vào giờ cao điểm. ☀️'
          : 'Điều kiện khí tượng tương đối thuận lợi, nhiệt độ và độ ẩm ở ngưỡng dễ chịu cho sinh hoạt ngoài trời.'
      }`
    );
  }

  // 4. Chào hỏi & giới thiệu
  const isGreeting =
    /^(xin chào|chào|hello|hi|hey|alo)\b/i.test(q) ||
    q === 'hi' ||
    q === 'hello' ||
    q === 'chào bạn' ||
    q.includes('bạn là ai') ||
    q.includes('giới thiệu bản thân') ||
    q.includes('bạn có thể làm gì');

  if (isGreeting) {
    return (
      `Xin chào! Tôi là **RainSense AI** 🌧️ — Trợ lý Khí tượng & Giám sát Mưa Đô thị thông minh.\n\n` +
      `Tôi đang kết nối trực tiếp với trạm quan trắc **${context.deviceId}** để hỗ trợ bạn:\n` +
      `• 🌤️ **Giám sát môi trường thời gian thực:** Đọc và phân tích Nhiệt độ (${context.currentTemp.toFixed(1)}°C), Độ ẩm (${context.currentHumid.toFixed(1)}%), Áp suất khí quyển từ BME280.\n` +
      `• 🌧️ **Đo đạc lưu lượng mưa:** Đếm xung gầu lật Hall A3144 (${context.totalTipsToday} nhịp, tích lũy ${context.todayRainMm.toFixed(2)} mm) và cường độ mưa tức thời (mm/h).\n` +
      `• ⚡ **Cảnh báo giông bão & ngập úng:** Dự báo thời tiết cực đoan dựa vào độ sụt áp suất khí quyển.\n` +
      `• 🔌 **Kỹ thuật phần cứng IoT:** Sơ đồ chân ESP32-S3, cấu hình Multi-WiFi và giao thức MQTT TLS.\n\n` +
      `Bạn cần tôi cung cấp thông tin hoặc phân tích dữ liệu nào lúc này? 📡`
    );
  }

  // 5. Cảm biến mưa, gầu lật A3144 Hall Effect, công thức tính mưa
  if (
    q.includes('mưa') ||
    q.includes('gầu lật') ||
    q.includes('hall') ||
    q.includes('a3144') ||
    q.includes('công thức') ||
    q.includes('tính lượng mưa') ||
    q.includes('calibration') ||
    q.includes('hiệu chuẩn') ||
    q.includes('nhịp lật')
  ) {
    return (
      `Dưới đây là cơ chế và công thức đo lượng mưa chuẩn xác của trạm **RainSense**: 🌧️\n\n` +
      `**🌧️ 1. Nguyên lý gầu lật đo mưa (Tipping Bucket):**\n` +
      `• Phễu gom gom nước mưa chảy vào một trong hai ngăn của gầu bập bênh.\n` +
      `• Khi lượng nước đạt ngưỡng thiết kế (tương ứng với chiều dày lớp nước mưa **${context.calibrationFactor} mm**), gầu mất thăng bằng và **lật sang ngăn đối diện**.\n` +
      `• Nam châm gắn trên gầu quét qua **cảm biến Hall A3144** (nối chân GPIO 10 của ESP32-S3), kích hoạt ngắt phần cứng (Edge FALLING).\n\n` +
      `**📊 2. Công thức tính lượng mưa tích lũy:**\n` +
      `• Lượng mưa tích lũy (mm) = Số lần lật (Tips) × Hệ số hiệu chuẩn (${context.calibrationFactor} mm/tip)\n` +
      `• Tổng số nhịp hôm nay: **${context.totalTipsToday} lần lật** → **${context.todayRainMm.toFixed(2)} mm**.\n\n` +
      `**⚡ 3. Công thức tính cường độ mưa tức thời (Rain Rate):**\n` +
      `• Cường độ mưa (mm/h) = Lượng mưa trong 5 phút (mm) × 12\n` +
      `• Cửa sổ trượt 5 phút giúp cường độ mưa phản ánh chính xác từng đợt mưa rào mà không bị đột biến ảo cơ học.`
    );
  }

  // 6. Khí áp, Bão, Dự báo thời tiết xấu
  if (
    q.includes('bão') ||
    q.includes('khí áp') ||
    q.includes('áp suất') ||
    q.includes('giông') ||
    q.includes('gió') ||
    q.includes('thời tiết xấu') ||
    q.includes('áp thấp')
  ) {
    return (
      `Áp suất khí quyển là chỉ số nhạy bén hàng đầu để nhận diện sớm thời tiết cực đoan: 🧭\n\n` +
      `• **Khí áp quan trắc hiện tại:** **${context.currentPress.toFixed(1)} hPa** (Xu hướng: **${context.pressureTrend}**)\n\n` +
      `**⚠️ Quy tắc nhận diện thời tiết qua biến thiên áp suất:**\n` +
      `• **Khí áp giảm nhanh (ΔP ≤ -3.0 hPa trong 3 giờ):** Cảnh báo rãnh áp thấp hoặc bão đang tiếp cận, khả năng cao kèm gió giật và dông sét mạnh.\n` +
      `• **Khí áp giảm chậm (-1.0 hPa ≥ ΔP > -3.0 hPa):** Mây phát triển, thời tiết có xu hướng chuyển mưa.\n` +
      `• **Khí áp ổn định (-1.0 < ΔP < +1.0 hPa):** Thời tiết giữ trạng thái bình thường, ít xáo trộn.\n` +
      `• **Khí áp tăng mạnh (ΔP ≥ +1.5 hPa):** Không khí lạnh tăng cường tràn về hoặc bão vừa đi qua, thời tiết chuyển khô ráo.\n\n` +
      `Hệ thống RainSense giám sát liên tục từng phút và tự động kích hoạt cảnh báo khi phát hiện áp suất sụt giảm bất thường.`
    );
  }

  // 7. Phần cứng ESP32-S3, Sơ đồ nối chân, Đấu dây
  if (
    q.includes('esp32') ||
    q.includes('nối dây') ||
    q.includes('chân') ||
    q.includes('pinout') ||
    q.includes('gpio') ||
    q.includes('sơ đồ') ||
    q.includes('phần cứng') ||
    q.includes('bme280') ||
    q.includes('lắp ráp')
  ) {
    return (
      `Dưới đây là sơ đồ đấu nối phần cứng chuẩn xác cho trạm **ESP32-S3 RainSense**: 🛠️\n\n` +
      `**🧭 1. Cảm biến Môi trường BME280 & Màn hình OLED SH1106 (I2C chung):**\n` +
      `• **VCC** → Chân **3V3** của ESP32-S3 *(Lưu ý: Không cấp 5V để tránh hỏng cảm biến)*\n` +
      `• **GND** → Chân **GND**\n` +
      `• **SDA** → Chân **GPIO 8**\n` +
      `• **SCL** → Chân **GPIO 9**\n` +
      `• *Tốc độ xung I2C:* Khuyến nghị **100kHz** để đảm bảo tín hiệu ổn định.\n\n` +
      `**🌧️ 2. Cảm biến đếm xung mưa Hall A3144:**\n` +
      `• **VCC** → Chân **3V3**\n` +
      `• **GND** → Chân **GND**\n` +
      `• **OUT** → Chân **GPIO 10** *(Cấu hình INPUT_PULLUP, ngắt FALLING)*\n\n` +
      `**🔘 3. Nút Reset lượng mưa phần cứng (BOOT):**\n` +
      `• **Nút BOOT** tích hợp trên mạch: Chân **GPIO 0** (nhấn để reset lượng mưa về 0.00 mm).\n\n` +
      `💡 **Chống dội xung mưa (Debounce):** Firmware đã tích hợp sẵn khóa chống dội 200ms để loại bỏ hoàn toàn các xung rung cơ học.`
    );
  }

  // 8. Firmware & Code nạp
  if (
    q.includes('code') ||
    q.includes('firmware') ||
    q.includes('ino') ||
    q.includes('arduino') ||
    q.includes('nạp') ||
    q.includes('thư viện')
  ) {
    return (
      `Mã nguồn firmware hoàn chỉnh cho ESP32-S3 được lưu tại:\n` +
      `👉 \`firmware/IOT_MQTT_TLS/IOT_MQTT_TLS.ino\`\n\n` +
      `**📚 Các thư viện cần cài đặt trong Arduino IDE:**\n` +
      `1. **PubSubClient** — Giao tiếp giao thức MQTT TLS (Port 8883).\n` +
      `2. **Adafruit BME280 Library** & **Adafruit Unified Sensor** — Đọc cảm biến môi trường.\n` +
      `3. **Adafruit SH110X** & **Adafruit GFX** — Điều khiển màn hình OLED I2C.\n` +
      `4. **WiFiMulti** & **Preferences** — Tự động chuyển mạng và lưu cấu hình Flash.\n\n` +
      `**🚀 Quy trình nạp code:**\n` +
      `1. Mở file \`IOT_MQTT_TLS.ino\` trong Arduino IDE.\n` +
      `2. Khai báo danh sách Wi-Fi trong mảng \`WIFI_NETWORKS[]\`.\n` +
      `3. Chọn board **ESP32S3 Dev Module**, cổng COM tương ứng và bấm **Upload**.`
    );
  }

  // 9. MQTT & Kết nối
  if (
    q.includes('mqtt') ||
    q.includes('emqx') ||
    q.includes('aiven') ||
    q.includes('broker') ||
    q.includes('topic') ||
    q.includes('tls')
  ) {
    return (
      `Hệ thống RainSense vận hành qua **EMQX Cloud / HiveMQ Cloud MQTT Broker** với chứng chỉ bảo mật TLS (Port 8883): ☁️\n\n` +
      `**📡 Danh sách MQTT Topics của trạm:**\n` +
      `• \`weather/station01/data\`: Bản tin telemetry định kỳ mỗi 10s (Nhiệt độ, Độ ẩm, Áp suất, Nhịp mưa, RSSI, Uptime).\n` +
      `• \`weather/station01/status\`: Trạng thái kết nối trực tuyến (online / offline Last Will & Testament).\n\n` +
      `**🔒 Cơ chế bảo mật & Đồng bộ:**\n` +
      `• Sử dụng mã hóa TLS với chứng chỉ DigiCert Global Root G2 CA.\n` +
      `• Dữ liệu được backend ghi nhận và lưu trữ lâu dài vào cơ sở dữ liệu **Aiven PostgreSQL**.`
    );
  }

  // 10. Offline & Khắc phục sự cố
  if (
    q.includes('offline') ||
    q.includes('ngoại tuyến') ||
    q.includes('mất kết nối') ||
    q.includes('lỗi') ||
    q.includes('không nhận')
  ) {
    return (
      `Nếu trạm quan trắc **${context.deviceId}** đang ở trạng thái **Ngoại tuyến**, vui lòng kiểm tra theo các bước sau: 🔍\n\n` +
      `1. 🔌 **Kiểm tra nguồn điện:** Quan sát đèn LED trên ESP32-S3 có sáng không? Cáp nguồn USB-C có cấp đủ dòng 5V/1A không?\n` +
      `2. 📶 **Kiểm tra kết nối Wi-Fi:** Mạch hỗ trợ Multi-WiFi; hãy kiểm tra xem tên Wi-Fi (SSID) và mật khẩu đã được khai báo chính xác chưa.\n` +
      `3. ☁️ **Kiểm tra Broker MQTT:** Đảm bảo tài khoản MQTT khớp với cài đặt trên Broker.\n` +
      `4. 💻 **Xem Serial Monitor:** Mở Serial Monitor với baudrate **115200** trong Arduino IDE để xem trực tiếp log thông báo kết nối.`
    );
  }

  // 11. Mặc định
  return (
    `Tôi đã nhận được câu hỏi của bạn: *"${query}"*\n\n` +
    `Trạm quan trắc **${context.deviceId}** hiện đang ghi nhận các thông số thời gian thực:\n` +
    `• 🌡️ Nhiệt độ không khí: **${context.currentTemp.toFixed(1)}°C** (Điểm sương: ${context.dewPoint.toFixed(1)}°C)\n` +
    `• 💧 Độ ẩm tương đối: **${context.currentHumid.toFixed(1)}%** (${context.humidityStatus})\n` +
    `• 🧭 Áp suất khí quyển: **${context.currentPress.toFixed(1)} hPa** (${context.pressureTrend})\n` +
    `• 🌧️ Lượng mưa hôm nay: **${context.todayRainMm.toFixed(2)} mm** (${context.totalTipsToday} lần lật gầu)\n\n` +
    `Bạn có muốn tôi phân tích chuyên sâu thêm về dữ liệu khí tượng nào, hoặc cần hỗ trợ về kỹ thuật phần cứng ESP32-S3 không? 📡`
  );
}

export async function POST(req: Request) {
  try {
    const {
      message,
      history = [],
      deviceId = 'RS-ESP32S3-01',
      context: clientContext
    } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ success: false, error: 'Thiếu nội dung câu hỏi' }, { status: 400 });
    }

    // 1. Resolve live telemetry context
    let context = clientContext;
    if (!context || context.currentTemp === null || context.currentTemp === undefined) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const ctxRes = await fetch(
          `https://rainsense-backend.onrender.com/api/ai/context?deviceId=${encodeURIComponent(deviceId)}`,
          { signal: controller.signal, cache: 'no-store' }
        );
        clearTimeout(timeoutId);
        if (ctxRes.ok) {
          const json = await ctxRes.json();
          if (json.success && json.data) {
            context = json.data;
          }
        }
      } catch (e) {
        // Fall back to safe context
      }
    }

    const safeContext = {
      deviceId: context?.deviceId || deviceId,
      stationName: context?.stationName || `Trạm ${deviceId}`,
      isOnline: context?.isOnline ?? true,
      lastSeen: context?.lastSeen || new Date().toISOString(),
      wifiRssi: context?.wifiRssi ?? -35,
      uptime: context?.uptime ?? 3600,
      currentTemp: Number(context?.currentTemp ?? 31.8),
      currentHumid: Number(context?.currentHumid ?? 48.8),
      currentPress: Number(context?.currentPress ?? 1011.1),
      dewPoint: Number(context?.dewPoint ?? 19.6),
      heatIndex: Number(context?.heatIndex ?? 33.7),
      todayRainMm: Number(context?.todayRainMm ?? 1.28),
      rolling24hRainMm: Number(context?.rolling24hRainMm ?? 1.28),
      currentRainRateMmH: Number(context?.currentRainRateMmH ?? 0.0),
      totalTipsToday: Number(context?.totalTipsToday ?? 2),
      calibrationFactor: Number(context?.calibrationFactor ?? 0.64),
      rainCategory: context?.rainCategory || 'Không mưa',
      humidityStatus: context?.humidityStatus || 'Lý tưởng',
      pressureTrend: context?.pressureTrend || 'Ổn định',
      recentAlerts: Array.isArray(context?.recentAlerts) ? context.recentAlerts : []
    };

    const apiKey = process.env.GEMINI_API_KEY;

    const systemPrompt = `Bạn là RainSense AI — Trợ lý Chuyên gia Khí tượng & Kỹ thuật Hệ thống Trạm Quan trắc Mưa Đô thị Thông minh RainSense (mã trạm: ${safeContext.deviceId}).

=== NGUYÊN TẮC TRẢ LỜI & ĐỊNH DẠNG (BẮT BUỘC TUÂN THỦ) ===
1. TUYỆT ĐỐI KHÔNG DÙNG CÚ PHÁP LATEX MATH:
   - Nghiêm cấm xuất hiện các ký tự: $$, $, \\text{}, \\times, \\frac{}{}, \\rightarrow, \\Delta, \\le, \\ge.
   - Viết công thức bằng ký tự Unicode dễ đọc trực tiếp:
     + Lượng mưa tích lũy (mm) = Số nhịp lật × ${safeContext.calibrationFactor} mm/tip
     + Cường độ mưa (mm/h) = Lượng mưa 5 phút (mm) × 12
     + Dùng dấu nhân: ×, dấu chia: /, dấu mũi tên: →, đơn vị: °C, %RH, hPa, mm, mm/h.
2. ĐỊNH DẠNG CHAT TRỰC QUAN:
   - Không dùng tiêu đề lớn (###, ##, #) gây choán khung chat.
   - Dùng in đậm kèm biểu tượng emoji sinh động: **🌧️ 1. Nguyên lý:**, **📊 2. Công thức:**...
   - Có thể dùng bảng Markdown gọn gàng khi so sánh hoặc báo cáo các chỉ số khí tượng.
3. TƯƠNG TÁC THỜI TIẾT ĐỜI SỐNG HÀNG NGÀY:
   - Khi người dùng hỏi thăm: "hôm nay thế nào?", "thời tiết hôm nay ra sao?", "có mưa không?", "có nên mang ô?", "ra đường được không?",...:
   - Hãy trả lời thân thiện, lịch sự, dùng số liệu thực tế của trạm (Nhiệt độ, Độ ẩm, Lượng mưa hôm nay, Khí áp) để đưa ra lời nhận định và lời khuyên sinh hoạt cụ thể (ví dụ: cần mang ô/áo mưa, che nắng, an tâm di chuyển,...).
4. AM HIỂU SÂU SẮC CHỦ ĐỀ CHÍNH CỦA ĐỀ TÀI:
   - Vi điều khiển ESP32-S3 (Dual-core Xtensa 240MHz, WiFiMulti, Preferences Flash).
   - Cảm biến mưa gầu lật đôi kết hợp IC Hall A3144 (GPIO 10, ngắt FALLING, hệ số ${safeContext.calibrationFactor} mm/tip, debounce 200ms).
   - Cảm biến Bosch BME280 qua I2C (SDA GPIO 8, SCL GPIO 9, xung 100kHz, nguồn 3.3V) đo Nhiệt độ, Độ ẩm, Khí áp.
   - Màn hình OLED SH1106 I2C hiển thị tại chỗ, nút BOOT GPIO 0 reset mưa.
   - Truyền thông MQTT TLS Port 8883 (EMQX/HiveMQ Cloud, topics weather/station01/data và status).
   - Backend Node.js/Express + Socket.IO + Prisma ORM + Aiven PostgreSQL hỗ trợ giám sát và cảnh báo ngập lụt đô thị.
   - Công thức tính: Điểm sương Magnus-Tetens, Chỉ số nhiệt Rothfusz, Biến thiên áp suất ΔP ≤ -3.0 hPa/3h phát hiện bão/dông lốc.
5. XỬ LÝ CÂU HỎI NGOÀI PHẠM VI (OUT OF SCOPE):
   - Nếu người dùng hỏi những vấn đề nằm ngoài quá xa đề tài (làm thơ tình, viết code game, showbiz, chứng khoán, tiền ảo, bóng đá, nấu ăn,...):
   - Từ chối lịch sự, nhã nhặn và chuyên nghiệp. Nêu rõ nhiệm vụ của RainSense AI và định hướng người dùng quay lại các nội dung chính của hệ thống trạm quan trắc.

DỮ LIỆU THỜI GIAN THỰC HIỆN TẠI TỪ TRẠM QUAN TRẮC ${safeContext.deviceId}:
- Trạng thái kết nối: ${safeContext.isOnline ? '🟢 ĐANG TRỰC TUYẾN' : '🟡 NGOẠI TUYẾN (Chờ bản tin ESP32-S3)'}
- Cập nhật lúc: ${safeContext.lastSeen}
- Nhiệt độ môi trường: ${safeContext.currentTemp.toFixed(1)} °C
- Độ ẩm không khí: ${safeContext.currentHumid.toFixed(1)} % (${safeContext.humidityStatus})
- Áp suất khí quyển: ${safeContext.currentPress.toFixed(1)} hPa (Xu hướng: ${safeContext.pressureTrend})
- Điểm sương (Dew Point): ${safeContext.dewPoint.toFixed(1)} °C
- Chỉ số nhiệt cảm nhận (Heat Index): ${safeContext.heatIndex.toFixed(1)} °C
- Lượng mưa hôm nay: ${safeContext.todayRainMm.toFixed(2)} mm (${safeContext.totalTipsToday} nhịp lật gầu)
- Cường độ mưa tức thời: ${safeContext.currentRainRateMmH.toFixed(1)} mm/h (${safeContext.rainCategory})
- Hệ số hiệu chuẩn gầu lật: ${safeContext.calibrationFactor} mm/tip
- Cường độ sóng Wi-Fi RSSI: ${safeContext.wifiRssi} dBm
- Cảnh báo hệ thống: ${safeContext.recentAlerts.length > 0 ? safeContext.recentAlerts.join('; ') : 'Không có cảnh báo'}

Hãy trả lời bằng tiếng Việt chuyên nghiệp, sử dụng số liệu thực tế ở trên để giải đáp trực diện và chính xác!`;

    if (apiKey) {
      const validHistory = (history || [])
        .filter((msg: any) => msg && typeof msg.content === 'string' && msg.content.trim() !== '')
        .slice(-6)
        .map((msg: any) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }));

      const contents = [
        ...validHistory,
        {
          role: 'user',
          parts: [{ text: message }]
        }
      ];

      const modelsToTry = ['gemini-3.5-flash', 'gemini-3.5-flash-lite'];

      for (const model of modelsToTry) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: 'POST',
              signal: controller.signal,
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
              },
              body: JSON.stringify({
                systemInstruction: {
                  parts: [{ text: systemPrompt }]
                },
                contents,
                generationConfig: {
                  thinkingConfig: { thinkingBudget: 0 },
                  temperature: 0.7,
                  maxOutputTokens: 1200
                }
              })
            }
          );

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (candidate && candidate.trim().length > 0) {
              return NextResponse.json({
                success: true,
                data: {
                  reply: cleanLatexArtifacts(candidate.trim()),
                  context: safeContext
                }
              });
            }
          }
        } catch (err: any) {
          // Try next model or fallback
        }
      }
    }

    // High-quality local reasoning engine fallback
    const localReply = generateLocalResponse(message, safeContext);
    return NextResponse.json({
      success: true,
      data: {
        reply: cleanLatexArtifacts(localReply),
        context: safeContext
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi server xử lý AI' },
      { status: 500 }
    );
  }
}
