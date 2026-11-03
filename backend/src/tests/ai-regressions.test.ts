import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AiService } from '../services/ai.service';
import { parseObservationRequest } from '../shared/observation-report';
import { normalizeStationContext, generateRainSenseReply } from '../shared/rainsense-ai';
import { resolveChatQuestion } from '../shared/chat-context';
import { dataStore } from '../db/store';
import { env } from '../config/env';
import { isForecastQuery, forecastWindow } from '../services/ai-forecast.service';
import { getStartOfDayInTimezone, getStartOfMonthInTimezone } from '../shared/utils/time';

const now = new Date('2026-11-03T07:30:00Z');
const timezone = 'Asia/Ho_Chi_Minh';
describe('Chatbot regression audit', () => {
  it('uses the whole compound duration instead of just its first number', () => {
    for (const duration of ['1 giờ 30 phút', 'một tiếng rưỡi', '90 phút']) {
      const p = parseObservationRequest(`nhiệt độ trong ${duration}`, timezone, now);
      assert.equal(p.status, 'ready');
      if (p.status === 'ready') assert.equal(p.request.from, '2026-11-03T06:00:00.000Z', duration);
    }
  });
  it('does not ignore dates, weeks, months, comparisons or a past-point anchor', () => {
    for (const question of ['tổng lượng mưa tháng này', 'lượng mưa tuần trước', 'nhiệt độ từ 13:00 đến 14:00 ngày 02/11', 'nhiệt độ 1 giờ hay 2 giờ', 'nhiệt độ 2 giờ trước', 'lượng mưa từ 13:00 đến 14:00 và từ 14:00 đến 14:30', 'nhiệt độ từ 13:00 đến 14h3', 'nhiệt độ từ 13:00 đến 14h150', 'nhiệt độ từ 13:00 đến 14.15', 'nhiệt độ trong 30 giây']) {
      assert.equal(parseObservationRequest(question, timezone, now).status, 'invalid', question);
    }
  });
  it('uses the requested part of the day and includes minutes expressed with h', () => {
    const morning = parseObservationRequest('lượng mưa sáng nay', timezone, now);
    assert.equal(morning.status, 'ready');
    if (morning.status === 'ready') { assert.equal(morning.request.from, '2026-11-02T23:00:00.000Z'); assert.equal(morning.request.to, '2026-11-03T05:00:00.000Z'); }
    const clock = parseObservationRequest('áp suất từ 13h15 đến 14h15 hôm nay', timezone, now);
    assert.equal(clock.status, 'ready');
    if (clock.status === 'ready') { assert.equal(clock.request.from, '2026-11-03T06:15:00.000Z'); assert.equal(clock.request.to, '2026-11-03T07:15:00.000Z'); }
    assert.equal(parseObservationRequest('áp suất từ 13 giờ tới 14 giờ hôm nay', timezone, now).status, 'ready');
  });
  it('treats the Asia/Saigon alias as the same Vietnamese day and month boundaries', () => {
    assert.equal(getStartOfDayInTimezone(now, 'Asia/Saigon').toISOString(), '2026-11-02T17:00:00.000Z');
    assert.equal(getStartOfMonthInTimezone(now, 'Asia/Saigon').toISOString(), '2026-10-31T17:00:00.000Z');
  });
  it('does not apply yesterday measurements to a current follow-up', () => {
    const q = resolveChatQuestion('Còn nhiệt độ hiện tại?', [{ role: 'user', content: 'nhiệt độ hôm qua' }]);
    assert.doesNotMatch(q, /hôm qua/);
    assert.equal(parseObservationRequest(q, timezone, now).status, 'none');
  });
  it('recognizes tiếng and phút in future intervals without substituting six hours', () => {
    for (const duration of ['1 tiếng tới', '60 phút tới']) {
      assert.equal(isForecastQuery(`nhiệt độ ${duration}`), true);
      assert.equal(forecastWindow(`dự báo ${duration}`, timezone, now).to, '2026-11-03T08:30:00.000Z');
    }
    assert.equal(isForecastQuery('Hiện tại trạm có mưa không?'), false);
    assert.equal(isForecastQuery('Trạm đang mưa không?'), false);
    assert.equal(forecastWindow('dự báo 30 phút tới', timezone, now).unsupported, true);
    assert.equal(forecastWindow('dự báo 1 giờ hay 2 giờ tới', timezone, now).unsupported, true);
  });
  it('returns every requested current metric and never describes a gauge rate as confirmed heavy rain', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const id = 'CURRENT-ALL'; await dataStore.upsertDevice({ deviceId: id, name: id, rainMmPerTip: 0.64 });
    await dataStore.saveMeasurement({ deviceId: id, messageId: `${id}-now`, timestamp: now.toISOString(), temperature: 32, humidity: 62, pressure: 1011, uptime: 1, wifiRssi: -60 });
    await dataStore.updateDeviceStatus(id, true, now.toISOString());
    await dataStore.saveRainEvent({ deviceId: id, eventId: `${id}-rain`, timestamp: now.toISOString(), tipCount: 34, calibrationFactor: 0.64 });
    const key = env.GEMINI_API_KEY;
    try {
      env.GEMINI_API_KEY = 'test-only';
      t.mock.method(globalThis, 'fetch', async () => { throw Error('A measured snapshot must not call the language model'); });
      const r = await new AiService().chat('nhiệt độ độ ẩm áp suất lượng mưa hiện tại bao nhiêu?', [], id);
      assert.equal(r.metadata.mode, 'analysis');
      for (const label of ['Nhiệt độ', 'Độ ẩm', 'Áp suất', 'mm']) assert.ok(r.reply.includes(label), label);
      assert.match(r.reply, /chưa xác minh.*mưa tự nhiên/);
      assert.doesNotMatch(r.reply, /trạm ghi nhận mưa (?:to|rất to)/);
    } finally { env.GEMINI_API_KEY = key; }
  });
  it('reports available metrics when a user mentions an unverified amount in the question', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const r = await new AiService().chat('Báo cáo nhiệt độ độ ẩm áp suất lượng mưa 1 tiếng, tôi nhớ có 20 mm', [], 'AMOUNT-IN-QUESTION');
    assert.equal(r.metadata.mode, 'analysis');
    assert.ok(r.context.observationReport);
    assert.equal(Date.parse(r.context.observationReport.to) - Date.parse(r.context.observationReport.from), 3600000);
    assert.equal(r.context.observationReport.metrics.length, 4);
    assert.doesNotMatch(r.reply, /ghi nhận 20 mm/);
  });
  it('treats a present-tense rain question as a measurement request instead of a forecast', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const r = await new AiService().chat('Hiện tại trạm có mưa không?', [], 'PRESENT-RAIN');
    assert.equal(r.metadata.mode, 'analysis'); assert.equal(r.context.forecast, undefined);
    assert.match(r.reply, /chưa có báo cáo quan trắc/);
  });
  it('keeps provenance warnings even for rain-only history in RAM and for partial sensor validity', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const id = 'RAIN-ONLY-RAM'; await dataStore.upsertDevice({ deviceId: id, name: id });
    await dataStore.saveRainEvent({ deviceId: id, eventId: `${id}-rain`, timestamp: now.toISOString(), tipCount: 1, calibrationFactor: 0.64 });
    const result = await new AiService().chat('lượng mưa 1 giờ vừa qua', [], id);
    assert.match(result.reply, /bộ nhớ dự phòng/);
  });
  it('portable fallback also preserves every current metric and does not assert natural rain', () => {
    const c = normalizeStationContext({ stationName: 'TEST', observedAt: now.toISOString(), isOnline: true, currentTemp: 32, currentHumid: 62, currentPress: 1011, currentRainRateMmH: 261.1, todayRainMm: 21.76 }, 'TEST');
    const text = generateRainSenseReply('Phân tích thời tiết hiện tại', c, [], now);
    assert.match(text, /chưa xác minh.*mưa tự nhiên/);
    assert.doesNotMatch(text, /trạm ghi nhận mưa rất to/);
    const multi = generateRainSenseReply('nhiệt độ độ ẩm áp suất hiện tại?', c, [], now);
    assert.match(multi, /32\.0 °C/); assert.match(multi, /62\.0 %/); assert.match(multi, /1011\.0 hPa/);
    const bare = generateRainSenseReply('Nhiệt độ, độ ẩm, áp suất?', c, [], now);
    assert.match(bare, /32\.0 °C/); assert.match(bare, /62\.0 %/); assert.match(bare, /1011\.0 hPa/);
  });
});
