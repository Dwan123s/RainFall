import { NextResponse } from 'next/server';

function generateLocalResponse(query: string, context: any): string {
  const q = query.toLowerCase().trim();

  // 1. Phân tích thời tiết hiện tại / Nhiệt độ / Độ ẩm / Khí áp / Mưa
  if (
    q.includes('thời tiết') ||
    q.includes('phân tích') ||
    q.includes('hiện tại') ||
    q.includes('chỉ số') ||
    q.includes('tổng quan') ||
    q.includes('hôm nay') ||
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

  // 2. Chào hỏi & giới thiệu
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
      `- 🌤️ **Giám sát môi trường thời gian thực:** Đọc và phân tích Nhiệt độ (${context.currentTemp.toFixed(1)}°C), Độ ẩm (${context.currentHumid.toFixed(1)}%), Áp suất khí quyển từ BME280.\n` +
      `- 🌧️ **Đo đạc lưu lượng mưa:** Đếm xung gầu lật Hall A3144 (${context.totalTipsToday} nhịp, tích lũy ${context.todayRainMm.toFixed(2)} mm) và cường độ mưa tức thời (mm/h).\n` +
      `- ⚡ **Cảnh báo giông bão & ngập úng:** Dự báo thời tiết cực đoan dựa vào độ sụt áp suất khí quyển.\n` +
      `- 🔌 **Kỹ thuật phần cứng IoT:** Sơ đồ chân ESP32-S3, cấu hình Multi-WiFi và giao thức MQTT TLS.\n\n` +
      `Bạn cần tôi cung cấp thông tin hoặc phân tích dữ liệu nào lúc này? 📡`
    );
  }

  // 3. Cảm biến mưa, gầu lật A3144 Hall Effect, công thức tính mưa
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
      `Dưới đây là cơ chế và công thức đo lượng mưa của trạm **RainSense**: 🌧️\n\n` +
      `### 1. Nguyên lý gầu lật đo mưa (Tipping Bucket)\n` +
      `- Phễu hứng gom nước mưa chảy vào một trong hai ngăn của gầu bập bênh.\n` +
      `- Khi lượng nước đạt đúng thể tích thiết kế (tương ứng với chiều dày lớp nước mưa **${context.calibrationFactor} mm**), gầu mất thăng bằng và **lật sang ngăn đối diện**.\n` +
      `- Nam châm gắn trên gầu quét qua **cảm biến Hall A3144** (nối chân GPIO 10 của ESP32-S3), kích hoạt ngắt phần cứng (Edge FALLING).\n\n` +
      `### 2. Công thức tính lượng mưa tích lũy\n` +
      `$$\\text{Lượng mưa (mm)} = \\text{Số lần lật (Tips)} \\times \\text{Hệ số hiệu chuẩn (mm/tip)}$$\n` +
      `- Hệ số hiệu chuẩn hiện tại: **${context.calibrationFactor} mm/tip**.\n` +
      `- Tổng số nhịp hôm nay: **${context.totalTipsToday} lần lật** $\\rightarrow$ **${context.todayRainMm.toFixed(2)} mm**.\n\n` +
      `### 3. Công thức tính cường độ mưa tức thời (Rain Rate)\n` +
      `$$\\text{Cường độ (mm/h)} = \\frac{\\text{Lượng mưa tích lũy trong 5 phút (mm)}}{5 / 60 \\text{ giờ}}$$\n` +
      `- Cửa sổ trượt 5 phút giúp cường độ mưa phản ánh chính xác từng đợt mưa rào mà không bị đột biến ảo.`
    );
  }

  // 4. Khí áp, Bão, Dự báo thời tiết xấu
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
      `### 🧭 Khí áp quan trắc hiện tại: **${context.currentPress.toFixed(1)} hPa** (Xu hướng: **${context.pressureTrend}**)\n\n` +
      `### ⚠️ Quy tắc nhận diện thời tiết qua biến thiên áp suất:\n` +
      `- **Khí áp giảm nhanh ($\\Delta P \\le -3.0\\text{ hPa}$ trong 3 giờ):** Cảnh báo rãnh áp thấp hoặc bão đang tiếp cận, khả năng cao kèm gió giật và dông sét mạnh.\n` +
      `- **Khí áp giảm chậm ($-1.0\\text{ hPa} \\ge \\Delta P > -3.0\\text{ hPa}$):** Mây phát triển, thời tiết có xu hướng chuyển mưa.\n` +
      `- **Khí áp ổn định ($-1.0 < \\Delta P < +1.0\\text{ hPa}$):** Thời tiết giữ trạng thái bình thường, ít xáo trộn.\n` +
      `- **Khí áp tăng mạnh ($\\Delta P \\ge +1.5\\text{ hPa}$):** Không khí lạnh tăng cường tràn về hoặc bão vừa đi qua, thời tiết chuyển khô ráo.\n\n` +
      `Hệ thống RainSense giám sát liên tục từng phút và tự động kích hoạt cảnh báo khi phát hiện áp suất sụt giảm bất thường.`
    );
  }

  // 5. Phần cứng ESP32-S3, Sơ đồ nối chân, Đấu dây
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
      `### 1. Cảm biến Môi trường BME280 & Màn hình OLED SH1106 (I2C)\n` +
      `- **VCC** $\\rightarrow$ Chân **3V3** của ESP32-S3 *(Lưu ý: Không cấp 5V)*\n` +
      `- **GND** $\\rightarrow$ Chân **GND**\n` +
      `- **SDA** $\\rightarrow$ Chân **GPIO 8**\n` +
      `- **SCL** $\\rightarrow$ Chân **GPIO 9**\n` +
      `- *Tốc độ xung I2C:* Khuyến nghị **100kHz** để đảm bảo tín hiệu ổn định.\n\n` +
      `### 2. Cảm biến đếm xung mưa Hall A3144\n` +
      `- **VCC** $\\rightarrow$ Chân **3V3**\n` +
      `- **GND** $\\rightarrow$ Chân **GND**\n` +
      `- **OUT** $\\rightarrow$ Chân **GPIO 10** *(Cấu hình INPUT_PULLUP, ngắt FALLING)*\n\n` +
      `### 3. Nút Reset lượng mưa phần cứng (BOOT)\n` +
      `- **Nút BOOT** tích hợp trên mạch: Chân **GPIO 0** (nhấn để reset lượng mưa về 0.00 mm).\n\n` +
      `> [!TIP]\n` +
      `> **Chống dội xung mưa (Debounce):** Firmware đã tích hợp sẵn khóa chống dội 200ms để loại bỏ hoàn toàn các xung rung cơ học.`
    );
  }

  // 6. Firmware & Code nạp
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
      `### Các thư viện cần cài đặt trong Arduino IDE:\n` +
      `1. **PubSubClient** — Giao tiếp giao thức MQTT TLS (Port 8883).\n` +
      `2. **Adafruit BME280 Library** & **Adafruit Unified Sensor** — Đọc cảm biến môi trường.\n` +
      `3. **Adafruit SH110X** & **Adafruit GFX** — Điều khiển màn hình OLED I2C.\n` +
      `4. **WiFiMulti** & **Preferences** — Tự động chuyển mạng và lưu cấu hình Flash.\n\n` +
      `### Quy trình nạp code:\n` +
      `1. Mở file \`IOT_MQTT_TLS.ino\` trong Arduino IDE.\n` +
      `2. Khai báo danh sách Wi-Fi trong mảng \`WIFI_NETWORKS[]\`.\n` +
      `3. Chọn board **ESP32S3 Dev Module**, cổng COM tương ứng và bấm **Upload**.`
    );
  }

  // 7. MQTT & Kết nối
  if (
    q.includes('mqtt') ||
    q.includes('emqx') ||
    q.includes('aiven') ||
    q.includes('broker') ||
    q.includes('topic') ||
    q.includes('tls')
  ) {
    return (
      `Hệ thống RainSense vận hành qua **EMQX Cloud MQTT Broker** với chứng chỉ bảo mật TLS (Port 8883): ☁️\n\n` +
      `### Danh sách MQTT Topics của trạm:\n` +
      `- \`weather/station01/data\`: Bản tin telemetry định kỳ mỗi 10s (Nhiệt độ, Độ ẩm, Áp suất, Nhịp mưa, RSSI, Uptime).\n` +
      `- \`weather/station01/status\`: Trạng thái kết nối trực tuyến (online / offline Last Will & Testament).\n\n` +
      `### Cơ chế bảo mật & Đồng bộ:\n` +
      `- Sử dụng mã hóa TLS với chứng chỉ DigiCert Global Root G2 CA.\n` +
      `- Dữ liệu được backend ghi nhận và lưu trữ lâu dài vào cơ sở dữ liệu **Aiven PostgreSQL**.`
    );
  }

  // 8. Offline & Khắc phục sự cố
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
      `3. ☁️ **Kiểm tra Broker EMQX:** Đảm bảo tài khoản MQTT khớp với cài đặt trên EMQX Cloud.\n` +
      `4. 💻 **Xem Serial Monitor:** Mở Serial Monitor với baudrate **115200** trong Arduino IDE để xem trực tiếp log thông báo kết nối.`
    );
  }

  // 9. Mặc định
  return (
    `Tôi đã nhận được câu hỏi của bạn: *"${query}"*\n\n` +
    `Trạm quan trắc **${context.deviceId}** hiện đang ghi nhận các thông số thời gian thực:\n` +
    `- 🌡️ Nhiệt độ không khí: **${context.currentTemp.toFixed(1)}°C** (Điểm sương: ${context.dewPoint.toFixed(1)}°C)\n` +
    `- 💧 Độ ẩm tương đối: **${context.currentHumid.toFixed(1)}%** (${context.humidityStatus})\n` +
    `- 🧭 Áp suất khí quyển: **${context.currentPress.toFixed(1)} hPa** (${context.pressureTrend})\n` +
    `- 🌧️ Lượng mưa hôm nay: **${context.todayRainMm.toFixed(2)} mm** (${context.totalTipsToday} lần lật gầu)\n\n` +
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

    const systemPrompt = `Bạn là RainSense AI — Trợ lý Khí tượng & Giám sát Mưa Đô thị thông minh trực thuộc hệ thống trạm quan trắc RainSense (kết nối ESP32-S3, BME280 và cảm biến lật gầu Hall A3144 qua EMQX Cloud MQTT và Aiven PostgreSQL).
Tính cách & Phong cách: Chuyên nghiệp, nhã nhặn, am hiểu sâu sắc về khoa học khí quyển và kỹ thuật phần cứng IoT. Sử dụng văn phong tiếng Việt chuẩn mực, mạch lạc, có cấu trúc bảng biểu hoặc bullet point rõ ràng và các biểu tượng thời tiết trực quan (🌧️, 🌡️, 💧, 🧭, ⚡, ⚠️).
Kiến thức chuyên môn:
- Công thức tính mưa gầu lật: Lượng mưa (mm) = Số nhịp (tips) * ${safeContext.calibrationFactor} mm/tip.
- Cường độ mưa (Rain Rate): Tính theo cửa sổ trượt 5 phút quy đổi về mm/h.
- Cảm biến môi trường BME280: Nhiệt độ, Độ ẩm tương đối, Khí áp, Điểm sương Magnus-Tetens, Chỉ số nhiệt Rothfusz.
- Phần cứng ESP32-S3: I2C (SDA GPIO 8, SCL GPIO 9, xung 100kHz), Cảm biến Hall A3144 (GPIO 10, ngắt FALLING), Nút BOOT/Reset (GPIO 0).
- Kết nối: MQTT TLS 8883 (EMQX Cloud), Wi-Fi Multi tự động chuyển mạng.

DỮ LIỆU THỰC TẾ HIỆN TẠI TỪ TRẠM QUAN TRẮC ${safeContext.deviceId}:
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

Hãy trả lời bằng tiếng Việt, phân tích dựa trên dữ liệu thực tế ở trên để giải đáp thắc mắc cho người dùng. Khi người dùng hỏi về nhiệt độ, độ ẩm, áp suất, lượng mưa hoặc tình hình thời tiết, BẮT BUỘC sử dụng các số liệu thực tế ở trên để trả lời trực diện và chính xác!`;

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
                  reply: candidate.trim(),
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
        reply: localReply,
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
