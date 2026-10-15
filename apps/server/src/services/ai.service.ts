import { dataStore } from '../db/store';
import { rainfallService } from '../services/rainfall.service';
import { measurementService } from '../services/measurement.service';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import {
  calculateDewPoint,
  calculateHeatIndex,
  classifyPressureTrend,
  getHumidityStatusVi,
  getRainRateCategoryVi
} from '@rainsense/shared';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class AiService {
  /**
   * Get current live weather context for the station
   */
  async getLiveContext(deviceId: string = env.DEFAULT_STATION_ID) {
    const device = await dataStore.getDevice(deviceId);
    const latest = await dataStore.getLatestMeasurement(deviceId);
    const rainfall = await rainfallService.getStatistics(deviceId);
    const envSummary = await measurementService.getEnvironmentalSummary(deviceId);
    const config = await dataStore.getConfig(deviceId);
    const recentAlerts = await dataStore.getAlerts({ deviceId, limit: 3 });

    const currentTemp = latest?.temperature ?? envSummary?.temperature?.current ?? null;
    const currentHumid = latest?.humidity ?? envSummary?.humidity?.current ?? null;
    const currentPress = latest?.pressure ?? envSummary?.pressure?.current ?? null;
    const dewPoint = currentTemp !== null && currentHumid !== null ? calculateDewPoint(currentTemp, currentHumid) : null;
    const heatIndex = currentTemp !== null && currentHumid !== null ? calculateHeatIndex(currentTemp, currentHumid) : null;
    const rainCategory = getRainRateCategoryVi(rainfall?.currentRateMmH ?? 0);
    const humidityStatus = currentHumid !== null ? getHumidityStatusVi(currentHumid) : null;
    const pressureTrend = currentPress !== null ? classifyPressureTrend(currentPress) : null;

    return {
      deviceId: device?.deviceId || deviceId,
      stationName: device?.name || 'Trạm Quan Trắc ESP32-S3',
      isOnline: device?.isOnline ?? false,
      lastSeen: device?.lastSeen || null,
      wifiRssi: device?.wifiRssi ?? latest?.wifiRssi ?? null,
      uptime: latest?.uptime ?? null,
      currentTemp,
      currentHumid,
      currentPress,
      dewPoint,
      heatIndex,
      todayRainMm: rainfall?.todayMm ?? 0,
      rolling24hRainMm: rainfall?.rolling24hMm ?? 0,
      currentRainRateMmH: rainfall?.currentRateMmH ?? 0,
      totalTipsToday: rainfall?.totalTipsToday ?? 0,
      calibrationFactor: config?.rainMmPerTip ?? rainfall?.calibrationFactor ?? 0.25,
      rainCategory: rainCategory.labelVi,
      humidityStatus: humidityStatus?.label || 'Chờ dữ liệu',
      pressureTrend: pressureTrend?.labelVi || 'Chờ dữ liệu',
      recentAlerts: recentAlerts.map((a) => a.message)
    };
  }

  /**
   * Process a chat message with live context
   */
  async chat(
    userMessage: string,
    history: ChatMessage[] = [],
    deviceId: string = env.DEFAULT_STATION_ID
  ): Promise<{ reply: string; context: any }> {
    const context = await this.getLiveContext(deviceId);

    // 1. If GEMINI_API_KEY is configured in environment, attempt external LLM call
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const reply = await this.callGeminiApi(userMessage, history, context, geminiKey);
        if (reply) {
          return { reply, context };
        }
      } catch (err: any) {
        logger.warn({ err: err.message }, 'Gemini API call failed, falling back to built-in Chiikawa reasoning engine');
      }
    }

    // 2. Intelligent Built-in Chiikawa Engine (Rule & Expert reasoning)
    const reply = this.generateBuiltinResponse(userMessage, context);
    return { reply, context };
  }

  /**
   * Gemini API integration with grounding
   */
  private async callGeminiApi(
    userMessage: string,
    history: ChatMessage[],
    context: any,
    apiKey: string
  ): Promise<string | null> {
    const systemPrompt = `Bạn là Chiikawa (ちいかわ) — Trợ lý AI Khí tượng & IoT thông minh, đáng yêu của trạm quan trắc RainSense (kết nối ESP32-S3, BME280 và cảm biến lật gầu Hall A3144 qua MQTT HiveMQ Cloud).
Tính cách: Rất dễ thương, nhiệt tình, vui vẻ, hay dùng các biểu cảm icon đáng yêu như ( ˶ᵔ ᵕ ᵔ˶ ), ( ˶•̀֊•́˶ ), ( •̀ ω •́ )✧, (｡•́‿•̀｡), Waaah!, "nè!", "nha!".
Kiến thức: Trả lời cực kỳ chuẩn xác, sâu sắc về khí tượng học (nhiệt độ, độ ẩm, khí áp, điểm sương Magnus-Tetens, chỉ số nhiệt Rothfusz, tính lượng mưa bằng gầu lật mm = tips * 0.25 mm/tip, cường độ mưa mm/h theo cửa sổ trượt 5 phút) và kỹ thuật nhúng ESP32-S3 (I2C SDA GPIO21, SCL GPIO22, ngắt GPIO4, MQTT TLS 8883, QoS 1).

DỮ LIỆU TRẠM THỰC TẾ HIỆN TẠI TỪ PHẦN CỨNG:
- Trạm: ${context.stationName} (${context.deviceId})
- Trạng thái kết nối: ${context.isOnline ? 'ĐANG TRỰC TUYẾN' : 'NGOẠI TUYẾN (Chờ ESP32-S3)'}
- Nhiệt độ: ${context.currentTemp !== null ? `${context.currentTemp.toFixed(1)} °C` : 'Chưa có bản tin'}
- Độ ẩm: ${context.currentHumid !== null ? `${context.currentHumid.toFixed(1)} % (${context.humidityStatus})` : 'Chưa có'}
- Áp suất khí quyển: ${context.currentPress !== null ? `${context.currentPress.toFixed(1)} hPa (Xu hướng: ${context.pressureTrend})` : 'Chưa có'}
- Điểm sương: ${context.dewPoint !== null ? `${context.dewPoint.toFixed(1)} °C` : '--'}
- Chỉ số nhiệt cảm nhận: ${context.heatIndex !== null ? `${context.heatIndex.toFixed(1)} °C` : '--'}
- Lượng mưa hôm nay: ${context.todayRainMm.toFixed(2)} mm (${context.totalTipsToday} nhịp lật gầu)
- Cường độ mưa tức thời: ${context.currentRainRateMmH.toFixed(1)} mm/h (${context.rainCategory})
- Hệ số hiệu chuẩn gầu lật: ${context.calibrationFactor} mm/tip
- Wi-Fi RSSI: ${context.wifiRssi !== null ? `${context.wifiRssi} dBm` : '--'}
- Uptime: ${context.uptime ? `${Math.floor(context.uptime / 3600)}h ${Math.floor((context.uptime % 3600) / 60)}m` : '--'}
- Cảnh báo gần đây: ${context.recentAlerts.length > 0 ? context.recentAlerts.join('; ') : 'Không có'}

Hãy trả lời bằng tiếng Việt, ngắn gọn, súc tích, định dạng Markdown đẹp, sử dụng dữ liệu thực tế ở trên để phân tích và trả lời câu hỏi của người dùng.`;

    const contents = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }]
      },
      ...history.slice(-6).map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      })),
      {
        role: 'user',
        parts: [{ text: userMessage }]
      }
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return candidate || null;
  }

  /**
   * Built-in Expert Reasoning Engine for Chiikawa
   */
  private generateBuiltinResponse(query: string, context: any): string {
    const q = query.toLowerCase().trim();

    // 1. Lời chào & Hỏi thăm
    if (
      q.includes('chào') ||
      q.includes('hello') ||
      q.includes('hi') ||
      q.includes('bạn là ai') ||
      q.includes('chiikawa') ||
      q.includes('giới thiệu') ||
      q.includes('tên gì')
    ) {
      return (
        `Chào bạn nha! Mình là **Chiikawa** — Trợ lý AI Khí tượng & IoT của hệ thống RainSense ( ˶ᵔ ᵕ ᵔ˶ )! ✨\n\n` +
        `Mình luôn túc trực ở đây để đồng hành cùng bạn và trạm quan trắc **${context.deviceId}** nè! Bạn có thể hỏi mình:\n` +
        `- 🌤️ **Tình hình thời tiết hiện tại**: Nhiệt độ, độ ẩm, khí áp BME280.\n` +
        `- 🌧️ **Đo đạc lượng mưa**: Kiểm tra nhịp lật gầu cảm biến Hall A3144, lượng mưa hôm nay và cường độ tức thời.\n` +
        `- 🔌 **Hỗ trợ phần cứng ESP32-S3**: Sơ đồ nối chân, mạch lọc chống dội xung (debounce), nạp firmware Arduino.\n` +
        `- ⚡ **Cảnh báo giông bão**: Dự đoán thời tiết nguy hiểm dựa trên xu hướng khí áp.\n\n` +
        `Bạn muốn Chiikawa giải đáp điều gì trước nè? ( ˶•̀֊•́˶ )`
      );
    }

    // 2. Phân tích thời tiết hiện tại / Tổng quan
    if (
      q.includes('thời tiết') ||
      q.includes('hiện tại') ||
      q.includes('chỉ số') ||
      q.includes('tổng quan') ||
      q.includes('hôm nay') ||
      q.includes('đánh giá') ||
      q.includes('nhiệt độ') ||
      q.includes('độ ẩm')
    ) {
      if (!context.isOnline && context.currentTemp === null) {
        return (
          `Waaah! Hiện tại trạm **${context.deviceId}** đang ở trạng thái **Ngoại tuyến (Chờ kết nối)** nên Chiikawa chưa nhận được bản tin đo đạc mới nhất nè (｡•́‿•̀｡).\n\n` +
          `🔍 **Trạng thái trạm:**\n` +
          `- **Tên:** ${context.stationName}\n` +
          `- **Kết nối:** Chưa nhận tín hiệu từ vi điều khiển ESP32-S3.\n` +
          `- **Lượng mưa hôm nay:** 0.00 mm (0 nhịp lật).\n\n` +
          `👉 Bạn hãy cắm nguồn cho bo mạch ESP32-S3 và nạp firmware \`RainSense_ESP32S3.ino\` nhé! Ngay khi trạm gửi bản tin MQTT đầu tiên, Chiikawa sẽ phân tích thời tiết chi tiết cho bạn liền! ( ˶ᵔ ᵕ ᵔ˶ )`
        );
      }

      const tempStr = context.currentTemp !== null ? `${context.currentTemp.toFixed(1)}°C` : '--';
      const humidStr = context.currentHumid !== null ? `${context.currentHumid.toFixed(1)}%` : '--';
      const pressStr = context.currentPress !== null ? `${context.currentPress.toFixed(1)} hPa` : '--';
      const dewStr = context.dewPoint !== null ? `${context.dewPoint.toFixed(1)}°C` : '--';
      const heatStr = context.heatIndex !== null ? `${context.heatIndex.toFixed(1)}°C` : '--';

      return (
        `Dưới đây là báo cáo thời tiết thời gian thực từ trạm **${context.deviceId}** mà Chiikawa vừa ghi nhận được nè ( ˶•̀֊•́˶ )! 🌤️\n\n` +
        `| Thông số | Giá trị quan trắc | Đánh giá | \n` +
        `|---|---|---| \n` +
        `| 🌡️ **Nhiệt độ không khí** | **${tempStr}** | Điểm sương: ${dewStr} | \n` +
        `| 💧 **Đo ẩm tương đối** | **${humidStr}** | Trạng thái: ${context.humidityStatus} | \n` +
        `| 🧭 **Áp suất khí quyển** | **${pressStr}** | Xu hướng: ${context.pressureTrend} | \n` +
        `| 🌧️ **Lượng mưa hôm nay** | **${context.todayRainMm.toFixed(2)} mm** | ${context.totalTipsToday} nhịp lật gầu | \n` +
        `| ⚡ **Cường độ tức thời** | **${context.currentRainRateMmH.toFixed(1)} mm/h** | Cấp độ: ${context.rainCategory} | \n` +
        `| 🌡️ **Nhiệt cảm nhận (Heat Index)** | **${heatStr}** | Phương trình Rothfusz | \n\n` +
        `💡 **Lời khuyên của Chiikawa:** ${
          context.todayRainMm > 15
            ? 'Hôm nay trời có mưa lớn, bạn nhớ mang ô và áo mưa khi ra ngoài nha! ☔'
            : context.currentTemp > 35
            ? 'Thời tiết khá nóng bức, hãy uống nhiều nước và tránh ở ngoài trời nắng gắt nhé! ☀️'
            : 'Thời tiết hiện tại tương đối dễ chịu, rất thích hợp cho các hoạt động ngoài trời nè! ( ˶ᵔ ᵕ ᵔ˶ )'
        }`
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
        `Để Chiikawa giải thích cho bạn cách trạm RainSense đo lượng mưa bằng **cảm biến Hall A3144** và **gầu lật (Tipping Bucket)** siêu chuẩn xác nhé ( •̀ ω •́ )✧!\n\n` +
        `### 1. Nguyên lý hoạt động\n` +
        `- Phễu hứng nước mưa sẽ dẫn nước chảy vào 1 trong 2 ngăn của gầu lật hình bập bênh.\n` +
        `- Khi lượng nước tích đủ thể tích thiết kế, gầu sẽ mất thăng bằng và **lật sang bên kia**.\n` +
        `- Gắn trên gầu là 1 viên nam châm neodymium nhỏ. Khi gầu lật, nam châm quét qua **cảm biến Hall A3144** gắn trên chân **GPIO 4** của ESP32-S3, tạo ra một xung mức thấp (Edge FALLING).\n\n` +
        `### 2. Công thức tính lượng mưa tích lũy\n` +
        `$$\\text{Lượng mưa (mm)} = \\text{Số nhịp lật (Tips)} \\times \\text{Hệ số hiệu chuẩn (mm/tip)}$$\n` +
        `- Hiện tại hệ số hiệu chuẩn của trạm là: **${context.calibrationFactor} mm/tip**.\n` +
        `- Hôm nay trạm đã ghi nhận: **${context.totalTipsToday} nhịp lật** $\\rightarrow$ **${context.todayRainMm.toFixed(2)} mm**.\n\n` +
        `### 3. Công thức tính cường độ mưa tức thời (Rain Rate)\n` +
        `$$\\text{Rain Rate (mm/h)} = \\frac{\\text{Lượng mưa trong 5 phút (mm)}}{5 / 60 \\text{ giờ}}$$\n` +
        `Dùng cửa sổ trượt 5 phút giúp cường độ mưa phản ánh chính xác từng cơn mưa rào mà không bị nhảy đột biến nè! ( ˶•̀֊•́˶ )`
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
      const pressVal = context.currentPress !== null ? `${context.currentPress.toFixed(1)} hPa` : 'chưa có dữ liệu';
      return (
        `Áp suất khí quyển là "chiếc phong vũ biểu" dự báo thời tiết cực kỳ nhạy bén đó nha! Chiikawa sẽ hướng dẫn bạn theo dõi nè ( •̀ ω •́ )✧\n\n` +
        `### 🧭 Khí áp hiện tại của trạm: **${pressVal}** (Xu hướng: **${context.pressureTrend}**)\n\n` +
        `### ⚠️ Quy tắc phát hiện giông bão qua biến thiên áp suất:\n` +
        `- **Khí áp giảm nhanh ($\\Delta P \\le -3.0\\text{ hPa}$ trong 3 giờ):** Đây là dấu hiệu rõ ràng của rãnh áp thấp hoặc tâm bão / áp thấp nhiệt đới đang tiến gần, kèm theo gió mạnh và mưa dông!\n` +
        `- **Khí áp giảm chậm ($-1.0\\text{ hPa} \\ge \\Delta P > -3.0\\text{ hPa}$):** Thường báo hiệu mây tăng và có thể có mưa nhẹ.\n` +
        `- **Khí áp ổn định ($-1.0 < \\Delta P < +1.0\\text{ hPa}$):** Thời tiết duy trì trạng thái bình thường.\n` +
        `- **Khí áp tăng mạnh ($\\Delta P \\ge +1.5\\text{ hPa}$):** Không khí lạnh tăng cường tràn về hoặc bão vừa tan, thời tiết sẽ khô ráo trở lại.\n\n` +
        `Bạn hãy yên tâm, hệ thống RainSense của chúng mình theo dõi liên tục từng giây và sẽ gửi thông báo cảnh báo tức thời nếu khí áp giảm sâu nha! ( ˶ᵔ ᵕ ᵔ˶ )`
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
        `Chiikawa đã chuẩn bị sẵn sơ đồ đấu nối chân chuẩn xác nhất cho **ESP32-S3 Dev Module** nè ( ˶•̀֊•́˶ )! 🛠️\n\n` +
        `### 1. Cảm biến nhiệt ẩm khí áp BME280 (Giao tiếp I2C)\n` +
        `- **VCC** $\\rightarrow$ Chân **3V3** của ESP32-S3 *(Lưu ý: Không cắm 5V để tránh cháy cảm biến nha!)*\n` +
        `- **GND** $\\rightarrow$ Chân **GND**\n` +
        `- **SDA** $\\rightarrow$ Chân **GPIO 21**\n` +
        `- **SCL** $\\rightarrow$ Chân **GPIO 22**\n\n` +
        `### 2. Cảm biến đếm xung mưa Hall A3144\n` +
        `- **Chân 1 (VCC)** $\\rightarrow$ Chân **3V3**\n` +
        `- **Chân 2 (GND)** $\\rightarrow$ Chân **GND**\n` +
        `- **Chân 3 (OUT)** $\\rightarrow$ Chân **GPIO 4** *(Chân ngắt phần cứng External Interrupt)*\n\n` +
        `> [!TIP]\n` +
        `> **Mẹo chống dội xung từ Chiikawa:** Hãy gắn một điện trở kéo lên **10kΩ** từ GPIO 4 lên 3.3V, và một tụ gốm **100nF** nối giữa GPIO 4 và GND. Mạch lọc RC này sẽ loại bỏ hoàn toàn các xung từ tính dội giả do rung lắc gầu lật đó! ✨`
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
        `Mã nguồn nạp hoàn chỉnh cho ESP32-S3 đã được lưu sẵn trong thư mục dự án tại:\n` +
        `👉 \`firmware/RainSense_ESP32S3/RainSense_ESP32S3.ino\`\n\n` +
        `### Các thư viện Arduino cần cài đặt:\n` +
        `1. **PubSubClient** (Nick O'Leary) — Giao tiếp MQTT.\n` +
        `2. **Adafruit BME280 Library** — Đọc cảm biến môi trường.\n` +
        `3. **Adafruit Unified Sensor** — Lớp cảm biến nền tảng.\n` +
        `4. **ArduinoJson** (Benoit Blanchon) — Đóng gói chuỗi JSON telemetry.\n\n` +
        `### Hướng dẫn nạp trong 3 bước:\n` +
        `1. Mở file \`RainSense_ESP32S3.ino\` bằng Arduino IDE.\n` +
        `2. Điền tên & mật khẩu Wi-Fi (\`WIFI_SSID\`, \`WIFI_PASS\`) và HiveMQ Cloud Cluster URL.\n` +
        `3. Chọn Board **ESP32S3 Dev Module**, cổng COM tương ứng và bấm **Upload** là xong ngay nè! ( ˶ᵔ ᵕ ᵔ˶ )`
      );
    }

    // 7. MQTT & HiveMQ Cloud
    if (
      q.includes('mqtt') ||
      q.includes('hivemq') ||
      q.includes('broker') ||
      q.includes('topic') ||
      q.includes('lwt')
    ) {
      return (
        `Hệ thống RainSense sử dụng **HiveMQ Cloud MQTT Broker qua TLS (Port 8883)** cực kỳ bảo mật nè ( •̀ ω •́ )✧!\n\n` +
        `### Danh sách MQTT Topics chuẩn của trạm:\n` +
        `- \`weather/RS-ESP32S3-01/telemetry\`: Bản tin cảm biến định kỳ mỗi 30s (Nhiệt độ, Độ ẩm, Khí áp, Tổng nhịp mưa, RSSI, Uptime).\n` +
        `- \`weather/RS-ESP32S3-01/rain\`: Bản tin phát ngay lập tức khi gầu lật có xung mưa mới.\n` +
        `- \`weather/RS-ESP32S3-01/status\`: Trạng thái Online / LWT Offline (phát hiện mất nguồn ngay trong vài giây).\n` +
        `- \`weather/RS-ESP32S3-01/command\`: Lệnh điều khiển từ xa từ Dashboard gửi xuống vi điều khiển (reboot, ping, cấu hình).\n` +
        `- \`weather/RS-ESP32S3-01/command/ack\`: Bản tin xác nhận từ ESP32-S3 gửi ngược về cho Dashboard.`
      );
    }

    // 8. Trạm Offline / Mất kết nối
    if (
      q.includes('offline') ||
      q.includes('ngoại tuyến') ||
      q.includes('mất kết nối') ||
      q.includes('lỗi') ||
      q.includes('không nhận') ||
      q.includes('tại sao trạm')
    ) {
      return (
        `Waaah! Nếu trạm **${context.deviceId}** đang bị báo **Ngoại tuyến**, Chiikawa hướng dẫn bạn các bước kiểm tra cực nhanh nhé (｡•́‿•̀｡):\n\n` +
        `1. 🔌 **Kiểm tra nguồn điện:** Đèn LED trên ESP32-S3 có sáng không? Hãy thử cắm lại cáp USB Type-C sang cổng cấp nguồn ổn định (khuyên dùng nguồn 5V/2A).\n` +
        `2. 📶 **Kiểm tra Wi-Fi:** Đảm bảo SSID và mật khẩu trong code \`RainSense_ESP32S3.ino\` chính xác và sóng Wi-Fi tại vị trí đặt trạm đủ mạnh (RSSI > -75 dBm).\n` +
        `3. ☁️ **Kiểm tra HiveMQ Cloud:** Kiểm tra thông tin Cluster URL và tài khoản MQTT trong file \`.env\` và firmware có khớp nhau không.\n` +
        `4. 💻 **Mở Serial Monitor:** Bật Serial Monitor ở baudrate **115200** trong Arduino IDE để xem ESP32-S3 in ra thông báo lỗi ở bước nào nha!\n\n` +
        `Đừng lo lắng nha, Chiikawa tin là kiểm tra các bước trên là trạm sẽ kết nối lại ngay thôi nè! ( ˶ᵔ ᵕ ᵔ˶ )`
      );
    }

    // 9. Câu trả lời mặc định thông minh & thân thiện
    return (
      `Chiikawa đã nhận được câu hỏi của bạn nè: *"${query}"* ( ˶ᵔ ᵕ ᵔ˶ )!\n\n` +
      `Trạm quan trắc **${context.deviceId}** hiện đang ghi nhận:\n` +
      `- 🌡️ Nhiệt độ: **${context.currentTemp !== null ? `${context.currentTemp.toFixed(1)}°C` : 'Chờ dữ liệu'}**\n` +
      `- 💧 Độ ẩm: **${context.currentHumid !== null ? `${context.currentHumid.toFixed(1)}%` : 'Chờ dữ liệu'}**\n` +
      `- 🧭 Khí áp: **${context.currentPress !== null ? `${context.currentPress.toFixed(1)} hPa` : 'Chờ dữ liệu'}**\n` +
      `- 🌧️ Lượng mưa hôm nay: **${context.todayRainMm.toFixed(2)} mm** (${context.totalTipsToday} nhịp gầu)\n\n` +
      `Bạn có muốn Chiikawa giải thích thêm về cách tính toán khí tượng, hướng dẫn đấu nối chân cảm biến cho ESP32-S3 hay các topic MQTT không nè? ( ˶•̀֊•́˶ )`
    );
  }
}

export const aiService = new AiService();
