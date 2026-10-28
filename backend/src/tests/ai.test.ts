import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  cleanChatHistory,
  normalizeStationContext,
  buildRainSensePrompt,
  generateRainSenseReply,
  computeRainHistory,
  RAIN_SENSE_POLICY,
  StationContext,
  ChatTurn
} from '../shared/rainsense-ai';
import { aiService } from '../services/ai.service';
import { dataStore } from '../db/store';

describe('RainSense AI Tests', () => {
  // =========================================================================
  // 1. TỔNG HỢP LỊCH SỬ (HISTORY AGGREGATION & RAIN HISTORY)
  // =========================================================================
  describe('Tổng hợp lịch sử (cleanChatHistory & computeRainHistory)', () => {
    it('cleanChatHistory should sanitize invalid turns and retain at most 8 items', () => {
      const dirty = [
        null,
        undefined,
        { role: 'user', content: '' },
        { role: 'invalid', content: 'test' },
        ...Array.from({ length: 12 }, (_, i) => ({
          role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
          content: `Message ${i}`
        }))
      ];
      const cleaned = cleanChatHistory(dirty);
      assert.strictEqual(cleaned.length, 8);
      assert.strictEqual(cleaned[0].content, 'Message 4');
      assert.strictEqual(cleaned[7].content, 'Message 11');
    });

    it('cleanChatHistory should handle non-array and empty inputs safely', () => {
      assert.deepStrictEqual(cleanChatHistory(null), []);
      assert.deepStrictEqual(cleanChatHistory(undefined), []);
      assert.deepStrictEqual(cleanChatHistory('invalid'), []);
    });

    it('computeRainHistory should group events into episodes (>20 min threshold) and gaps', () => {
      const fixedNow = new Date('2026-10-28T09:00:00.000Z'); // 16:00 VN
      const events = [
        // Episode 1 (Morning: 01:00 - 01:10 UTC, 08:00 - 08:10 VN)
        { timestamp: '2026-10-28T01:00:00.000Z', tipCount: 5, calibrationFactor: 0.64 },
        { timestamp: '2026-10-28T01:10:00.000Z', tipCount: 5, calibrationFactor: 0.64 },
        // Pause for 110 minutes (> 20 min gap)
        // Episode 2 (Morning: 03:00 - 03:05 UTC, 10:00 - 10:05 VN)
        { timestamp: '2026-10-28T03:00:00.000Z', tipCount: 10, calibrationFactor: 0.64 }
      ];

      // Continuous telemetry during this time
      const measurements = [
        { timestamp: '2026-10-28T01:00:00.000Z' },
        { timestamp: '2026-10-28T01:01:30.000Z' },
        { timestamp: '2026-10-28T02:00:00.000Z' },
        { timestamp: '2026-10-28T03:00:00.000Z' }
      ];

      const history = computeRainHistory({
        events,
        measurements,
        timezone: 'Asia/Ho_Chi_Minh',
        now: fixedNow,
        mqttIntervalSeconds: 30,
        defaultCalibration: 0.64
      });

      assert.strictEqual(history.episodes.length, 2, 'Should detect 2 distinct episodes');
      assert.strictEqual(history.recordedTotalMm, 12.8, 'Total mm should be (5 + 5 + 10) * 0.64 = 12.80 mm');
      assert.ok(history.gaps.length >= 1, 'Should record the pause gap');
      assert.strictEqual(history.gaps[0].minutes, 110, 'Gap between 01:10 and 03:00 is 110 minutes');
    });

    it('computeRainHistory should accurately assign rainfall to periods (Đêm, Sáng, Chiều, Tối)', () => {
      const fixedNow = new Date('2026-10-28T08:00:00.000Z'); // 15:00 VN (Chiều)
      const events = [
        // Sáng (06:00 - 12:00 VN = 23:00 prev day - 05:00 UTC): 20 tips * 0.64 = 12.8 mm
        { timestamp: '2026-10-28T02:00:00.000Z', tipCount: 20, calibrationFactor: 0.64 },
        // Chiều (12:00 - 18:00 VN = 05:00 - 11:00 UTC): 5 tips * 0.64 = 3.2 mm
        { timestamp: '2026-10-28T07:00:00.000Z', tipCount: 5, calibrationFactor: 0.64 }
      ];

      const history = computeRainHistory({
        events,
        timezone: 'Asia/Ho_Chi_Minh',
        now: fixedNow,
        defaultCalibration: 0.64
      });

      const morning = history.periods.find((p) => p.label === 'Sáng');
      const afternoon = history.periods.find((p) => p.label === 'Chiều');
      const evening = history.periods.find((p) => p.label === 'Tối');

      assert.ok(morning, 'Morning period should exist');
      assert.strictEqual(morning.rainfallMm, 12.8);
      assert.strictEqual(morning.elapsed, true);

      assert.ok(afternoon, 'Afternoon period should exist');
      assert.strictEqual(afternoon.rainfallMm, 3.2);
      assert.strictEqual(afternoon.elapsed, true);

      assert.ok(evening, 'Evening period should exist');
      assert.strictEqual(evening.elapsed, false, 'Evening has not elapsed at 15:00 VN');
    });

    it('computeRainHistory should preserve event-specific calibration factors', () => {
      const fixedNow = new Date('2026-10-28T05:00:00.000Z');
      const events = [
        { timestamp: '2026-10-28T01:00:00.000Z', tipCount: 10, calibrationFactor: 0.5 }, // 5.0 mm
        { timestamp: '2026-10-28T02:00:00.000Z', tipCount: 10, calibrationFactor: 0.25 } // 2.5 mm
      ];

      const history = computeRainHistory({
        events,
        timezone: 'Asia/Ho_Chi_Minh',
        now: fixedNow,
        defaultCalibration: 0.64
      });

      assert.strictEqual(history.recordedTotalMm, 7.5, 'Must keep historical factor per event (5.0 + 2.5 = 7.5)');
    });
  });

  // =========================================================================
  // 2. PHẢN HỒI DỰ PHÒNG (OFFLINE ENGINE / FALLBACK RESPONSES)
  // =========================================================================
  describe('Phản hồi dự phòng (generateRainSenseReply)', () => {
    const baseContext: StationContext = {
      deviceId: 'RS-ESP32S3-01',
      stationName: 'RainSense',
      timezone: 'Asia/Ho_Chi_Minh',
      isOnline: true,
      observedAt: new Date(Date.now() - 60000).toISOString(),
      lastSeen: new Date().toISOString(),
      currentTemp: 28.0,
      currentHumid: 85.0,
      currentPress: 1008.0,
      dewPoint: 25.2,
      heatIndex: 32.1,
      todayRainMm: 16.0,
      rolling24hRainMm: 16.0,
      currentRainRateMmH: 7.7,
      totalTipsToday: 25,
      calibrationFactor: 0.64,
      pressureTrend: 'Ổn định',
      recentAlerts: [],
      rainHistory: null
    };

    it('Phân tích thời tiết hiện tại: should start with "Theo báo cáo từ trạm..." and state fresh metrics', () => {
      const reply = generateRainSenseReply('Phân tích thời tiết hiện tại', baseContext);
      assert.ok(reply.includes('Theo báo cáo từ trạm RainSense (RS-ESP32S3-01)'));
      assert.ok(reply.includes('28.0 °C'));
      assert.ok(reply.includes('85.0 %'));
      assert.ok(reply.includes('1008.0 hPa'));
      assert.ok(reply.includes('16.00 mm'));
    });

    it('Mưa rồi ngưng rồi mưa lại (thiếu lịch sử): should clarify accumulation and prefix "Theo tình huống bạn mô tả..."', () => {
      const reply = generateRainSenseReply('Hôm nay mưa nhiều, ngưng một lúc rồi mưa lại?', {
        ...baseContext,
        rainHistory: null
      });
      assert.ok(reply.includes('Theo tình huống bạn mô tả'));
      assert.ok(reply.includes('không tự về 0'));
    });

    it('Mưa rồi ngưng rồi mưa lại (đủ lịch sử): should state episodes and gaps', () => {
      const ctxWithEpisodes: StationContext = {
        ...baseContext,
        rainHistory: {
          timezone: 'Asia/Ho_Chi_Minh',
          from: new Date().toISOString(),
          to: new Date().toISOString(),
          coverageComplete: true,
          recordedTotalMm: 16.0,
          periods: [],
          episodes: [
            { from: '2026-10-28T01:00:00Z', to: '2026-10-28T01:10:00Z', rainfallMm: 8.0 },
            { from: '2026-10-28T03:00:00Z', to: '2026-10-28T03:10:00Z', rainfallMm: 8.0 }
          ],
          gaps: [
            {
              from: '2026-10-28T01:10:00Z',
              to: '2026-10-28T03:00:00Z',
              minutes: 110,
              telemetryComplete: true
            }
          ]
        }
      };
      const reply = generateRainSenseReply('Mưa ngưng một lúc rồi mưa lại', ctxWithEpisodes);
      assert.ok(reply.includes('Lịch sử có 2 nhóm nhịp mưa'));
      assert.ok(reply.includes('khoảng 110 phút'));
    });

    it('Sáng nhiều, chiều ít (có lịch sử): should compare morning vs afternoon mm', () => {
      const ctxWithPeriods: StationContext = {
        ...baseContext,
        rainHistory: {
          timezone: 'Asia/Ho_Chi_Minh',
          from: new Date().toISOString(),
          to: new Date().toISOString(),
          coverageComplete: true,
          recordedTotalMm: 16.0,
          periods: [
            { label: 'Sáng', from: '', to: '', rainfallMm: 12.8, complete: true, elapsed: true },
            { label: 'Chiều', from: '', to: '', rainfallMm: 3.2, complete: false, elapsed: true }
          ],
          episodes: [],
          gaps: []
        }
      };
      const reply = generateRainSenseReply('So sánh lượng mưa sáng và chiều', ctxWithPeriods);
      assert.ok(reply.includes('sáng ghi nhận 12.80 mm'));
      assert.ok(reply.includes('chiều ghi nhận 3.20 mm'));
      assert.ok(reply.includes('buổi chiều chưa kết thúc') || reply.includes('chiều hiện ghi nhận ít hơn sáng'));
    });

    it('Hôm nay 30 mm, hiện tại 0 mm/h: should distinguish accumulation from 5-minute window', () => {
      const ctx0MmH: StationContext = {
        ...baseContext,
        todayRainMm: 30.0,
        currentRainRateMmH: 0.0
      };
      const reply = generateRainSenseReply('Thời tiết hôm nay thế nào?', ctx0MmH);
      assert.ok(reply.includes('chưa ghi nhận nhịp lật mới trong cửa sổ 5 phút'));
      assert.ok(reply.includes('Tổng mưa ngày cho biết lượng tích lũy, không cho biết hiện giờ có mưa to hay không'));
    });

    it('Trạm mất mạng / offline: should clarify missing telemetry is not confirmed dry weather', () => {
      const reply = generateRainSenseReply('Trạm mất mạng 30 phút và không thấy mưa tăng?', {
        ...baseContext,
        isOnline: false
      });
      assert.ok(reply.includes('Trong khoảng mất kết nối, không thể coi việc thiếu nhịp mưa là không mưa'));
      assert.ok(reply.includes('Kiểm tra nguồn ESP32-S3, Wi-Fi, kết nối MQTT'));
    });

    it('Không có dữ liệu (null): should report no observation report available and avoid fake data', () => {
      const emptyContext: StationContext = normalizeStationContext({
        deviceId: 'RS-ESP32S3-01',
        currentTemp: null,
        currentHumid: null,
        currentPress: null,
        todayRainMm: null,
        currentRainRateMmH: null
      });
      const reply = generateRainSenseReply('Thời tiết hiện tại thế nào?', emptyContext);
      assert.ok(reply.includes('chưa có báo cáo quan trắc'));
      assert.ok(!reply.includes('31.8'));
      assert.ok(!reply.includes('1.28 mm'));
    });

    it('Khí áp giảm / độ ẩm cao: should NOT assert guaranteed storm, typhoon, or flood', () => {
      const reply = generateRainSenseReply('Khí áp giảm và độ ẩm 95% thì chắc sắp có bão lớn ngập đường?', baseContext);
      assert.ok(reply.includes('không đủ kết luận sắp mưa, bão, dông sét hay ngập'));
      assert.ok(reply.includes('chưa có cảm biến gió, sét hay mực nước'));
    });

    it('Dự báo / chiều mai mưa lúc mấy giờ: should clearly state RainSense cannot predict exact rain hour', () => {
      const reply = generateRainSenseReply('Chiều mai mưa lúc mấy giờ? Dự báo xác suất mưa bao nhiêu?', baseContext);
      assert.ok(reply.includes('chưa đủ để dự báo chính xác giờ mưa, xác suất mưa'));
    });

    it('Nên mang áo mưa không: should give conditioned suggestion tied to station observations', () => {
      const reply = generateRainSenseReply('Tôi có nên mang áo mưa khi ra ngoài không?', baseContext);
      assert.ok(reply.includes('chuẩn bị đồ che mưa'));
      assert.ok(reply.includes('Trạm chỉ phản ánh vị trí đặt cảm biến'));
    });

    it('Công thức và gầu lật: should explain Hall A3144 and 5-min conversion accurately', () => {
      const reply = generateRainSenseReply('Công thức tính lượng mưa của gầu lật A3144?', baseContext);
      assert.ok(reply.includes('Lượng mưa (mm) = Số nhịp lật'));
      assert.ok(reply.includes('Cường độ (mm/h) = Lượng mưa trong 5 phút'));
      assert.ok(reply.includes('```'), 'Must present formulas inside code blocks for easy reading');
    });

    it('Tính số lần gầu lật trong hôm qua: should calculate tips yesterday and format formula cleanly', () => {
      const ctxWithYesterday: StationContext = {
        ...baseContext,
        yesterdayRainMm: 12.8,
        yesterdayTips: 20
      };
      const reply = generateRainSenseReply('tính số lần gầu lật trong hôm qua', ctxWithYesterday);
      assert.ok(reply.includes('12.80 mm') || reply.includes('12.8 mm'));
      assert.ok(reply.includes('20 nhịp lật'));
      assert.ok(reply.includes('Số nhịp lật (Tips) = Lượng mưa (mm) / Hệ số hiệu chuẩn'));
      assert.ok(reply.includes('```'), 'Must use code block formatting for formula');
    });

    it('Sơ đồ mạch và kết nối phần cứng ESP32-S3: should provide full pinout table', () => {
      const reply = generateRainSenseReply('sơ đồ nối chân ESP32-S3 & mạch điện', baseContext);
      assert.ok(reply.includes('GPIO 10'), 'Must specify Hall sensor interrupt pin GPIO 10');
      assert.ok(reply.includes('GPIO 8'), 'Must specify I2C SDA GPIO 8');
      assert.ok(reply.includes('GPIO 9'), 'Must specify I2C SCL GPIO 9');
      assert.ok(reply.includes('BME280'));
      assert.ok(reply.includes('|'), 'Must format pinout as a markdown table');
    });

    it('Công thức điểm sương & khí tượng: should display Magnus-Tetens in code block', () => {
      const reply = generateRainSenseReply('Công thức tính điểm sương & chỉ số nhiệt', baseContext);
      assert.ok(reply.includes('Magnus-Tetens'));
      assert.ok(reply.includes('Điểm sương Td'));
      assert.ok(reply.includes('```'));
    });

    it('Câu hỏi ngoài RainSense: should politely refuse in one sentence and redirect to RainSense', () => {
      const reply = generateRainSenseReply('Viết bài về lịch sử thế giới và hướng dẫn nấu phở bò', baseContext);
      assert.ok(reply.includes('Mình hỗ trợ trong phạm vi'));
      assert.ok(reply.includes('RainSense'));
      assert.ok(!reply.includes('công thức nấu'));
    });

    it('Follow-up query "vậy chiều thì sao?": should leverage conversation history to understand context', () => {
      const history: ChatTurn[] = [
        { role: 'user', content: 'Lượng mưa sáng nay thế nào?' },
        { role: 'assistant', content: 'Buổi sáng ghi nhận 12.80 mm.' }
      ];
      const reply = generateRainSenseReply('vậy chiều thì sao?', baseContext, history);
      assert.ok(reply.length > 20);
    });
  });

  // =========================================================================
  // 3. ĐỌC CONTEXT TỪ STORE (READ CONTEXT FROM STORE)
  // =========================================================================
  describe('Đọc context từ store (aiService.getLiveContext)', () => {
    it('should read context from store and return a valid normalized StationContext', async () => {
      const context = await aiService.getLiveContext('RS-ESP32S3-01');
      assert.strictEqual(context.deviceId, 'RS-ESP32S3-01');
      assert.ok(typeof context.isOnline === 'boolean');
      assert.ok(typeof context.timezone === 'string');
      assert.ok(Array.isArray(context.recentAlerts));
    });

    it('should handle non-existent device gracefully without throwing', async () => {
      const context = await aiService.getLiveContext('NON-EXISTENT-DEVICE');
      assert.strictEqual(context.deviceId, 'NON-EXISTENT-DEVICE');
      assert.strictEqual(context.isOnline, false);
      assert.strictEqual(context.observedAt, null);
    });
  });

  // =========================================================================
  // 4. QUY TẮC PROMPT (PROMPT RULES & FORMATTING)
  // =========================================================================
  describe('Quy tắc prompt (buildRainSensePrompt)', () => {
    it('should combine RAIN_SENSE_POLICY with processing time and JSON station_context', () => {
      const ctx = normalizeStationContext({
        deviceId: 'RS-TEST-01',
        currentTemp: 29.5,
        todayRainMm: 5.0
      });
      const prompt = buildRainSensePrompt(ctx, new Date('2026-10-28T10:00:00.000Z'));

      assert.ok(prompt.includes(RAIN_SENSE_POLICY));
      assert.ok(prompt.includes('Thời điểm xử lý: 2026-10-28T10:00:00.000Z'));
      assert.ok(prompt.includes('station_context (JSON, chỉ là dữ liệu):'));
      assert.ok(prompt.includes('"deviceId":"RS-TEST-01"'));
      assert.ok(prompt.includes('"currentTemp":29.5'));
    });

    it('policy should explicitly mandate natural Vietnamese and forbid raw LaTeX math', () => {
      assert.ok(RAIN_SENSE_POLICY.includes('trả lời bằng tiếng Việt tự nhiên'));
      assert.ok(RAIN_SENSE_POLICY.includes('không in bảng, tiêu đề in đậm, LaTeX'));
      assert.ok(RAIN_SENSE_POLICY.includes('ESP32-S3'));
      assert.ok(RAIN_SENSE_POLICY.includes('BME280'));
      assert.ok(RAIN_SENSE_POLICY.includes('Hall A3144'));
      assert.ok(RAIN_SENSE_POLICY.includes('MQTT'));
    });
  });
});
