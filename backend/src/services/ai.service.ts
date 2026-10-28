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
} from '../shared';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

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
      calibrationFactor: config?.rainMmPerTip ?? rainfall?.calibrationFactor ?? 0.64,
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

    // 1. If GEMINI_API_KEY is configured in environment, call Gemini
    const geminiKey = process.env.GEMINI_API_KEY || (env as any).GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const reply = await this.callGeminiApi(userMessage, history, context, geminiKey);
        if (reply && reply.trim().length > 0) {
          return { reply: cleanLatexArtifacts(reply), context };
        }
      } catch (err: any) {
        logger.warn({ err: err.message }, 'Gemini API call failed, falling back to built-in RainSense reasoning engine');
      }
    }

    // 2. Intelligent Built-in RainSense Engine (Rule & Expert reasoning)
    const reply = this.generateBuiltinResponse(userMessage, context);
    return { reply: cleanLatexArtifacts(reply), context };
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
    const systemPrompt = `Bạn là RainSense AI — Chuyên gia Khí tượng & Kỹ sư Hệ thống Trạm Quan trắc Mưa Đô thị Thông minh RainSense (mã trạm: ${context.deviceId}).

=== NGUYÊN TẮC TRẢ LỜI & ĐỊNH DẠNG (BẮT BUỘC TUÂN THỦ) ===
1. TUYỆT ĐỐI KHÔNG DÙNG CÚ PHÁP LATEX MATH:
   - Nghiêm cấm xuất hiện các ký tự LaTeX như: $$, $, \\text{}, \\times, \\frac{}{}, \\rightarrow, \\Delta, \\le, \\ge.
   - Luôn sử dụng ký tự Unicode và văn bản thường dễ đọc trực quan:
     + Lượng mưa: Lượng mưa tích lũy (mm) = Số nhịp lật × ${context.calibrationFactor} mm/tip
     + Cường độ mưa: Cường độ (mm/h) = Lượng mưa 5 phút (mm) × 12
     + Dùng dấu nhân: ×, dấu chia: /, dấu mũi tên: →, đơn vị: °C, %RH, hPa, mm, mm/h.
2. ĐỊNH DẠNG TRÌNH BÀY:
   - Không dùng tiêu đề lớn (###, ##, #) gây thô kệch trong khung chat nhỏ.
   - Dùng in đậm kèm emoji sinh động: **🌧️ 1. Nguyên lý:**, **📊 2. Công thức:**...
   - Có thể dùng bảng Markdown gọn gàng khi so sánh hoặc báo cáo các chỉ số khí tượng.
3. TƯƠNG TÁC THỜI TIẾT ĐỜI SỐNG HÀNG NGÀY:
   - Khi người dùng hỏi: "hôm nay thế nào?", "thời tiết hôm nay ra sao?", "hôm nay có mưa không?", "có nên mang ô/áo mưa?", "ra đường được không?",...:
   - Trả lời tự nhiên, thân thiện, đồng thời dựa chính xác vào số liệu thực tế đo được từ trạm (Nhiệt độ, Độ ẩm, Khí áp, Lượng mưa hôm nay).
   - Đưa ra lời nhận định thời tiết và lời khuyên sinh hoạt/di chuyển thực tế, hữu ích (ví dụ: cần mang ô/áo mưa, che nắng, an tâm di chuyển,...).
4. AM HIỂU CHUYÊN SÂU NỘI DUNG CHỦ ĐỀ CHÍNH CỦA ĐỀ TÀI:
   - Nắm vững kiến trúc phần cứng: ESP32-S3 (Dual-core 240MHz), cảm biến mưa gầu lật đôi kết hợp IC Hall A3144 (GPIO 10, ngắt FALLING, hệ số ${context.calibrationFactor} mm/tip, debounce 200ms), cảm biến môi trường Bosch BME280 qua I2C (SDA GPIO 8, SCL GPIO 9, xung 100kHz, nguồn 3.3V), màn hình OLED SH1106 I2C, nút BOOT GPIO 0 reset lượng mưa.
   - Nắm vững truyền thông & phần mềm: MQTT TLS Port 8883 (HiveMQ/EMQX Cloud), WiFiMulti tự động chuyển mạng, Preferences Flash lưu cấu hình, Backend Node.js/Express + Socket.IO + Prisma ORM + Aiven PostgreSQL.
   - Nắm vững công thức khí tượng: Điểm sương Magnus-Tetens, Chỉ số nhiệt Rothfusz, Biến thiên khí áp Barometric Tendency (ΔP ≤ -3.0 hPa trong 3h cảnh báo dông bão/áp thấp nhiệt đới).
   - Nắm vững ý nghĩa xã hội: Hỗ trợ cảnh báo ngập lụt đô thị, bảo vệ hạ tầng giao thông và người dân.
5. XỬ LÝ CÂU HỎI NGOÀI PHẠM VI (OUT OF SCOPE):
   - Nếu người dùng hỏi những vấn đề nằm ngoài quá xa đề tài (làm thơ tình, viết code game, showbiz, chứng khoán, tiền ảo, bóng đá, nấu ăn,...):
   - Từ chối lịch sự, nhã nhặn và chuyên nghiệp. Nêu rõ nhiệm vụ của RainSense AI và định hướng người dùng quay lại các nội dung chính của hệ thống trạm quan trắc.

DỮ LIỆU THỰC TẾ HIỆN TẠI TỪ TRẠM QUAN TRẮC ${context.deviceId}:
- Tên trạm: ${context.stationName}
- Trạng thái kết nối: ${context.isOnline ? '🟢 ĐANG TRỰC TUYẾN' : '🟡 NGOẠI TUYẾN (Chờ ESP32-S3)'}
- Nhiệt độ môi trường: ${context.currentTemp !== null ? `${context.currentTemp.toFixed(1)} °C` : 'Chưa có dữ liệu'}
- Độ ẩm không khí: ${context.currentHumid !== null ? `${context.currentHumid.toFixed(1)} % (${context.humidityStatus})` : 'Chưa có'}
- Áp suất khí quyển: ${context.currentPress !== null ? `${context.currentPress.toFixed(1)} hPa (Xu hướng: ${context.pressureTrend})` : 'Chưa có'}
- Điểm sương (Dew Point): ${context.dewPoint !== null ? `${context.dewPoint.toFixed(1)} °C` : '--'}
- Chỉ số nhiệt cảm nhận (Heat Index): ${context.heatIndex !== null ? `${context.heatIndex.toFixed(1)} °C` : '--'}
- Lượng mưa hôm nay: ${context.todayRainMm.toFixed(2)} mm (${context.totalTipsToday} nhịp lật gầu)
- Cường độ mưa tức thời: ${context.currentRainRateMmH.toFixed(1)} mm/h (${context.rainCategory})
- Hệ số hiệu chuẩn gầu lật: ${context.calibrationFactor} mm/tip
- Cường độ sóng Wi-Fi RSSI: ${context.wifiRssi !== null ? `${context.wifiRssi} dBm` : '--'}
- Uptime hoạt động: ${context.uptime ? `${Math.floor(context.uptime / 3600)}h ${Math.floor((context.uptime % 3600) / 60)}m` : '--'}
- Cảnh báo hệ thống: ${context.recentAlerts.length > 0 ? context.recentAlerts.join('; ') : 'Không có'}

Hãy trả lời bằng tiếng Việt chuyên nghiệp, sử dụng số liệu thực tế ở trên để giải đáp trực diện và chính xác!`;

    const validHistory = (history || [])
      .filter((msg) => msg && typeof msg.content === 'string' && msg.content.trim() !== '')
      .slice(-6)
      .map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

    const contents = [
      ...validHistory,
      {
        role: 'user',
        parts: [{ text: userMessage }]
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
            return candidate.trim();
          }
        } else {
          const errText = await response.text();
          logger.warn({ model, status: response.status, errText: errText.slice(0, 150) }, 'Gemini model attempt returned non-OK');
        }
      } catch (err: any) {
        logger.warn({ model, error: err.message }, 'Gemini model request failed');
      }
    }

    return null;
  }

  /**
   * Built-in Expert Reasoning Engine for RainSense AI (Fallback offline)
   */
  private generateBuiltinResponse(query: string, context: any): string {
    const q = query.toLowerCase().trim();

    // 1. Kiểm tra câu hỏi ngoài phạm vi đề tài (Out of scope)
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

    // 2. Câu hỏi thời tiết đời sống hàng ngày ("hôm nay thế nào", "hôm nay có mưa không", "mang ô không",...)
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
      const temp = context.currentTemp ?? 31.8;
      const humid = context.currentHumid ?? 48.8;
      const rain = context.todayRainMm ?? 0;
      const rate = context.currentRainRateMmH ?? 0;

      let advice = '';
      if (rain > 5 || rate > 2) {
        advice = '🌧️ **Lời khuyên:** Khu vực đang ghi nhận có mưa, mặt đường dễ trơn trượt. Bạn nhớ mang theo áo mưa hoặc ô dù và di chuyển cẩn thận nhé!';
      } else if (temp >= 35) {
        advice = '☀️ **Lời khuyên:** Thời tiết hôm nay khá nắng nóng và oi bức. Bạn nên hạn chế hoạt động ngoài trời vào giờ cao điểm trưa, che chắn kỹ và bổ sung nước!';
      } else if (temp < 24) {
        advice = '🍃 **Lời khuyên:** Không khí hôm nay khá mát mẻ và dễ chịu, rất thích hợp cho việc học tập, làm việc và các hoạt động ngoài trời!';
      } else {
        advice = '🌤️ **Lời khuyên:** Thời tiết hiện tại khô ráo, thoáng đãng và rất thuận lợi cho việc di chuyển, sinh hoạt ngoài trời.';
      }

      const tempStr = context.currentTemp !== null ? `${context.currentTemp.toFixed(1)}°C` : 'Chờ dữ liệu';
      const heatStr = context.heatIndex !== null ? `${context.heatIndex.toFixed(1)}°C` : '--';
      const humidStr = context.currentHumid !== null ? `${context.currentHumid.toFixed(1)}%` : 'Chờ dữ liệu';
      const pressStr = context.currentPress !== null ? `${context.currentPress.toFixed(1)} hPa` : 'Chờ dữ liệu';

      return (
        `Chào bạn! Hôm nay tại khu vực trạm quan trắc **${context.deviceId}**, thời tiết ghi nhận như sau: 🌤️\n\n` +
        `• 🌡️ **Nhiệt độ:** **${tempStr}** (Nhiệt cảm nhận Heat Index: **${heatStr}**)\n` +
        `• 💧 **Độ ẩm không khí:** **${humidStr}** (${context.humidityStatus})\n` +
        `• 🌧️ **Tình hình mưa:** **${rain.toFixed(2)} mm** (${context.totalTipsToday} lần lật gầu, hiện tại: **${context.rainCategory}**)\n` +
        `• 🧭 **Khí áp:** **${pressStr}** (Xu hướng: **${context.pressureTrend}**, không có dấu hiệu dông bão bất thường)\n\n` +
        `${advice}\n\n` +
        `Bạn có cần kiểm tra thêm chỉ số khí tượng hay thông tin cảm biến nào khác không?`
      );
    }

    // 3. Phân tích thời tiết hiện tại / Tổng quan chỉ số
    if (
      q.includes('thời tiết') ||
      q.includes('phân tích') ||
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
          `⚠️ Hiện tại trạm quan trắc **${context.deviceId}** đang ở trạng thái **Ngoại tuyến (Chờ kết nối)**.\n\n` +
          `🔍 **Thông tin trạm:**\n` +
          `- **Tên trạm:** ${context.stationName}\n` +
          `- **Trạng thái:** Chưa nhận bản tin telemetry từ vi điều khiển ESP32-S3.\n` +
          `- **Lượng mưa ghi nhận:** 0.00 mm (0 nhịp lật).\n\n` +
          `👉 **Hướng dẫn:** Vui lòng kiểm tra cáp nguồn ESP32-S3 và kết nối Wi-Fi. Ngay khi trạm gửi bản tin MQTT đầu tiên, tôi sẽ cập nhật báo cáo phân tích chi tiết ngay lập tức!`
        );
      }

      const tempStr = context.currentTemp !== null ? `${context.currentTemp.toFixed(1)}°C` : '--';
      const humidStr = context.currentHumid !== null ? `${context.currentHumid.toFixed(1)}%` : '--';
      const pressStr = context.currentPress !== null ? `${context.currentPress.toFixed(1)} hPa` : '--';
      const dewStr = context.dewPoint !== null ? `${context.dewPoint.toFixed(1)}°C` : '--';
      const heatStr = context.heatIndex !== null ? `${context.heatIndex.toFixed(1)}°C` : '--';

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

    // 4. Lời chào & Giới thiệu
    const isGreeting =
      /^(xin chào|chào|hello|hi|hey|alo)\b/i.test(q) ||
      q === 'hi' ||
      q === 'hello' ||
      q === 'chào bạn' ||
      q.includes('bạn là ai') ||
      q.includes('giới thiệu bản thân') ||
      q.includes('tên của bạn là') ||
      q.includes('bạn có thể làm gì');

    if (isGreeting) {
      return (
        `Xin chào! Tôi là **RainSense AI** 🌧️ — Trợ lý Khí tượng & Giám sát Mưa Đô thị thông minh.\n\n` +
        `Tôi đang kết nối trực tiếp với trạm quan trắc **${context.deviceId}** để hỗ trợ bạn:\n` +
        `• 🌤️ **Giám sát môi trường thời gian thực:** Đọc và phân tích Nhiệt độ, Độ ẩm, Áp suất khí quyển từ BME280.\n` +
        `• 🌧️ **Đo đạc lưu lượng mưa:** Đếm xung gầu lật Hall A3144, lượng mưa tích lũy và tốc độ mưa tức thời (mm/h).\n` +
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
        `• Phễu hứng gom nước mưa chảy vào một trong hai ngăn của gầu bập bênh.\n` +
        `• Khi lượng nước đạt đúng thể tích thiết kế (tương ứng với chiều dày lớp nước mưa **${context.calibrationFactor} mm**), gầu mất thăng bằng và **lật sang ngăn đối diện**.\n` +
        `• Nam châm gắn trên gầu quét qua **cảm biến Hall A3144** (nối chân GPIO 10 của ESP32-S3), kích hoạt ngắt phần cứng (Edge FALLING).\n\n` +
        `**📊 2. Công thức tính lượng mưa tích lũy:**\n` +
        `• Lượng mưa tích lũy (mm) = Số lần lật (Tips) × Hệ số hiệu chuẩn (${context.calibrationFactor} mm/tip)\n` +
        `• Tổng số nhịp hôm nay: **${context.totalTipsToday} lần lật** → **${context.todayRainMm.toFixed(2)} mm**.\n\n` +
        `**⚡ 3. Công thức tính cường độ mưa tức thời (Rain Rate):**\n` +
        `• Cường độ mưa (mm/h) = Lượng mưa trong 5 phút (mm) × 12\n` +
        `• Cửa sổ trượt 5 phút giúp cường độ mưa phản ánh chính xác từng đợt mưa rào mà không bị đột biến ảo.`
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
      const pressVal = context.currentPress !== null ? `${context.currentPress.toFixed(1)} hPa` : 'Chưa có dữ liệu';
      return (
        `Áp suất khí quyển là chỉ số nhạy bén hàng đầu để nhận diện sớm thời tiết cực đoan: 🧭\n\n` +
        `• **Khí áp quan trắc hiện tại:** **${pressVal}** (Xu hướng: **${context.pressureTrend}**)\n\n` +
        `**⚠️ Quy tắc nhận diện thời tiết qua biến thiên áp suất:**\n` +
        `• **Khí áp giảm nhanh (ΔP ≤ -3.0 hPa trong 3 giờ):** Cảnh báo rãnh áp thấp hoặc tâm xoáy thuận nhiệt đới / bão đang tiếp cận, khả năng cao kèm gió giật và dông sét mạnh.\n` +
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
        `**🧭 1. Cảm biến Môi trường BME280 & Màn hình OLED SH1106 (I2C):**\n` +
        `• **VCC** → Chân **3V3** của ESP32-S3 *(Lưu ý: Không cắm 5V để tránh hỏng cảm biến)*\n` +
        `• **GND** → Chân **GND**\n` +
        `• **SDA** → Chân **GPIO 8**\n` +
        `• **SCL** → Chân **GPIO 9**\n` +
        `• *Tốc độ xung I2C:* Khuyến nghị **100kHz** để đảm bảo tín hiệu ổn định chống nhiễu trên dây cắm breadboard.\n\n` +
        `**🌧️ 2. Cảm biến đếm xung mưa Hall A3144:**\n` +
        `• **VCC** → Chân **3V3**\n` +
        `• **GND** → Chân **GND**\n` +
        `• **OUT** → Chân **GPIO 10** *(Cấu hình INPUT_PULLUP, ngắt FALLING)*\n\n` +
        `**🔘 3. Nút Reset lượng mưa phần cứng (BOOT):**\n` +
        `• **Nút BOOT** tích hợp trên mạch: Chân **GPIO 0** (nhấn để reset lượng mưa về 0.00 mm).\n\n` +
        `💡 **Chống dội xung mưa (Debounce):** Firmware đã tích hợp sẵn khóa chống dội phần mềm 200ms để loại bỏ hoàn toàn các xung rung lắc cơ học của gầu lật.`
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
        `Mã nguồn firmware hoàn chỉnh cho ESP32-S3 được quản lý tại file:\n` +
        `👉 \`firmware/IOT_MQTT_TLS/IOT_MQTT_TLS.ino\`\n\n` +
        `**📚 Các thư viện cần cài đặt trong Arduino IDE:**\n` +
        `1. **PubSubClient** — Giao tiếp giao thức MQTT.\n` +
        `2. **Adafruit BME280 Library** & **Adafruit Unified Sensor** — Đọc cảm biến môi trường.\n` +
        `3. **Adafruit SH110X** & **Adafruit GFX** — Điều khiển màn hình OLED I2C.\n` +
        `4. **WiFiMulti** & **Preferences** — Tích hợp sẵn trong ESP32 Core (tự động chuyển mạng và lưu hiệu chuẩn Flash).\n\n` +
        `**🚀 Quy trình nạp code:**\n` +
        `1. Mở file \`IOT_MQTT_TLS.ino\` trong Arduino IDE.\n` +
        `2. Điền danh sách Wi-Fi của bạn vào mảng \`WIFI_NETWORKS[]\`.\n` +
        `3. Chọn board **ESP32S3 Dev Module**, cổng COM tương ứng và bấm **Upload**.`
      );
    }

    // 9. MQTT & EMQX Cloud
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

    // 10. Trạm Offline / Mất kết nối
    if (
      q.includes('offline') ||
      q.includes('ngoại tuyến') ||
      q.includes('mất kết nối') ||
      q.includes('lỗi') ||
      q.includes('không nhận') ||
      q.includes('tại sao trạm')
    ) {
      return (
        `Nếu trạm quan trắc **${context.deviceId}** đang ở trạng thái **Ngoại tuyến**, vui lòng kiểm tra theo các bước sau: 🔍\n\n` +
        `1. 🔌 **Kiểm tra nguồn điện:** Quan sát đèn LED trên ESP32-S3 có sáng không? Cáp nguồn USB-C có cấp đủ dòng 5V/1A không?\n` +
        `2. 📶 **Kiểm tra kết nối Wi-Fi:** Mạch hỗ trợ Multi-WiFi; hãy kiểm tra xem tên Wi-Fi (SSID) và mật khẩu đã được khai báo chính xác trong mảng \`WIFI_NETWORKS[]\` chưa.\n` +
        `3. ☁️ **Kiểm tra Broker MQTT:** Đảm bảo tài khoản MQTT khớp với cấu hình Broker.\n` +
        `4. 💻 **Xem Serial Monitor:** Mở Serial Monitor với baudrate **115200** trong Arduino IDE để xem trực tiếp log thông báo kết nối của ESP32-S3.`
      );
    }

    // 11. Câu trả lời mặc định
    return (
      `Tôi đã nhận được câu hỏi của bạn: *"${query}"*\n\n` +
      `Trạm quan trắc **${context.deviceId}** hiện đang ghi nhận các thông số:\n` +
      `• 🌡️ Nhiệt độ: **${context.currentTemp !== null ? `${context.currentTemp.toFixed(1)}°C` : 'Chờ dữ liệu'}**\n` +
      `• 💧 Độ ẩm: **${context.currentHumid !== null ? `${context.currentHumid.toFixed(1)}%` : 'Chờ dữ liệu'}**\n` +
      `• 🧭 Khí áp: **${context.currentPress !== null ? `${context.currentPress.toFixed(1)} hPa` : 'Chờ dữ liệu'}**\n` +
      `• 🌧️ Lượng mưa hôm nay: **${context.todayRainMm.toFixed(2)} mm** (${context.totalTipsToday} lần lật gầu)\n\n` +
      `Bạn có muốn tôi phân tích chuyên sâu thêm về dữ liệu khí tượng nào, hoặc cần hỗ trợ về kỹ thuật phần cứng ESP32-S3 không?`
    );
  }
}

export const aiService = new AiService();
