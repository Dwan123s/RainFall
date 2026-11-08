import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { parseObservationRequest } from '../shared/observation-report';
import { calculateWeatherFeatures } from '../services/ai-weather-features';
import { AiService } from '../services/ai.service';
import { RainfallService } from '../services/rainfall.service';
import { dataStore } from '../db/store';
import { env } from '../config/env';
import { getStartOfDayInTimezone } from '../shared';
import { classifyRainEvents, readRainLedger } from '../services/rain-ledger';
import { advanceRainCounter } from '../services/rain-counter';
import { handleTelemetryMessage } from '../mqtt/handlers/telemetry.handler';
import { handleRainEventMessage } from '../mqtt/handlers/rain.handler';
import { rainAuditController } from '../controllers/rain-audit.controller';
import { authenticate, generateToken } from '../middleware/auth.middleware';
import { resolveChatQuestion } from '../shared/chat-context';
import { seedInitialData } from '../db/seed';

const timezone = 'Asia/Ho_Chi_Minh';
const now = new Date('2026-11-03T07:30:00Z');
const station = (deviceId: string) => dataStore.upsertDevice({ deviceId, name: deviceId, timezone, rainMmPerTip: 0.64 });
const measurement = (deviceId: string, at: string, tips = 0, humidity = 65) => dataStore.saveMeasurement({ deviceId, messageId: `measurement-${deviceId}-${at}`, timestamp: at, temperature: 30, humidity, pressure: 1010, wifiRssi: -50, uptime: 600, totalRainTips: tips });
const event = (deviceId: string, at: string, tips: number, factor = 0.64, intervalFrom?: string) => dataStore.saveRainEvent({ deviceId, eventId: `rain-${deviceId}-${at}`, timestamp: at, tipCount: tips, calibrationFactor: factor, intervalFrom, timingQuality: intervalFrom ? 'telemetry_interval' : 'device_tip' });

describe('Exact observation intervals', () => {
  it('accepts tiếng, giờ, h, minutes and one written in Vietnamese without silently using 24h', () => {
    for (const duration of ['1 tiếng', 'một tiếng', '1 giờ', '1h', '60 phút']) {
      const parsed = parseObservationRequest(`nhiệt độ độ ẩm áp suất lượng mưa trong ${duration}`, timezone, now);
      assert.equal(parsed.status, 'ready');
      if (parsed.status !== 'ready') continue;
      assert.equal(parsed.request.from, '2026-11-03T06:30:00.000Z');
      assert.equal(parsed.request.to, now.toISOString());
      assert.deepEqual(parsed.request.metrics, ['temperature', 'humidity', 'pressure', 'rain']);
    }
  });
  it('separates yesterday, clock ranges, future forecasts and invalid intervals', () => {
    const clock = parseObservationRequest('lượng mưa từ 13:00 đến 14:00 hôm nay', timezone, now);
    assert.equal(clock.status, 'ready');
    if (clock.status === 'ready') {
      assert.equal(clock.request.from, '2026-11-03T06:00:00.000Z');
      assert.equal(clock.request.includeEnd, false);
    }
    assert.equal(parseObservationRequest('nhiệt độ trong 0 tiếng', timezone, now).status, 'invalid');
    assert.equal(parseObservationRequest('nhiệt độ trong 8 ngày', timezone, now).status, 'invalid');
    assert.equal(parseObservationRequest('lượng mưa từ 15:00 đến 16:00', timezone, now).status, 'invalid');
    assert.equal(parseObservationRequest('Dự báo nhiệt độ 1 tiếng tới', timezone, now).status, 'none');
    const yesterday = parseObservationRequest('lượng mưa hôm qua', timezone, now);
    assert.equal(yesterday.status, 'ready');
    if (yesterday.status === 'ready') assert.equal(yesterday.request.from, '2026-11-01T17:00:00.000Z');
  });
  it('keeps every metric for a follow-up asking about one tiếng', () => {
    const query = resolveChatQuestion('Còn trong 1 tiếng?', [{ role: 'user', content: 'nhiệt độ độ ẩm áp suất lượng mưa hôm nay' }]);
    const parsed = parseObservationRequest(query, timezone, now);
    assert.equal(parsed.status, 'ready');
    if (parsed.status === 'ready') assert.equal(parsed.request.metrics.length, 4);
  });
  it('reports the available 89 samples for all metrics even when they cover only part of an hour, without calling a model', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const deviceId = 'PARTIAL-HOUR'; await station(deviceId);
    for (let i = 0; i < 89; i++) await measurement(deviceId, new Date(now.getTime() - i * 5000).toISOString());
    await event(deviceId, new Date(now.getTime() - 60000).toISOString(), 2);
    const oldKey = env.GEMINI_API_KEY;
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('Observation report must not call a model'); });
    try {
      env.GEMINI_API_KEY = 'test-key';
      const result = await new AiService().chat('nhiệt độ độ ẩm áp suất lượng mưa trong 1 tiếng', [], deviceId);
      assert.equal(result.metadata.mode, 'analysis');
      assert.equal(result.context.observationReport?.weather.temperature?.sampleCount, 89);
      assert.equal(result.context.observationReport?.weather.coverageComplete, false);
      for (const text of ['Nhiệt độ:', 'Độ ẩm:', 'Áp suất:', '1,28 mm', '89 bản đo', 'chưa phủ liên tục']) assert.ok(result.reply.includes(text), text);
      assert.doesNotMatch(result.reply, /Chưa đủ chuỗi khí áp|mưa rất to|missing_api_key/);
    } finally { env.GEMINI_API_KEY = oldKey; }
  });
  it('retains good temperature and pressure when humidity is invalid', async () => {
    const m = { id: 'x', deviceId: 'x', messageId: 'x', timestamp: now.toISOString(), createdAt: now.toISOString(), temperature: 31, humidity: -999, pressure: 1012, uptime: 1, wifiRssi: -50 };
    const features = calculateWeatherFeatures([m], new Date(now.getTime() - 3600000), now, 120000);
    assert.equal(features.temperature?.avg, 31); assert.equal(features.pressure?.avg, 1012);
    assert.equal(features.humidity, null); assert.equal(features.sampleCount, 0); assert.equal(features.availableSampleCount, 1);
  });
  it('states missing readings rather than rejecting every metric or claiming verified dry weather', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const result = await new AiService().chat('báo cáo nhiệt độ độ ẩm áp suất lượng mưa 1 tiếng', [], 'EMPTY-HOUR');
    assert.match(result.reply, /Nhiệt độ: chưa có số đo hợp lệ/);
    assert.match(result.reply, /không coi đoạn thiếu là không mưa/);
    assert.doesNotMatch(result.reply, /Chưa đủ chuỗi khí áp/);
  });
});

describe('One rain ledger and water-test provenance', () => {
  it('unifies dashboard and AI daily totals across midnight, changed calibration, lifetime counters and test labels', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const id = 'DAY-LEDGER'; await station(id);
    const midnight = getStartOfDayInTimezone(now, timezone).getTime();
    await event(id, new Date(midnight - 1000).toISOString(), 23);
    await event(id, new Date(midnight).toISOString(), 1, 0.25);
    await event(id, new Date(now.getTime() - 10000).toISOString(), 10);
    await event(id, new Date(now.getTime() - 5000).toISOString(), 1);
    await measurement(id, now.toISOString(), 11);
    await dataStore.saveRainTestPeriod({ deviceId: id, from: new Date(now.getTime() - 11000).toISOString(), to: new Date(now.getTime() - 9000).toISOString(), note: 'xả nước', createdBy: 'operator' });
    const stats = await new RainfallService().getStatistics(id, now);
    const context = await new AiService().getLiveContext(id);
    assert.equal(stats.todayMm, 0.89); assert.equal(stats.todayMm, context.todayRainMm);
    assert.equal(stats.totalTipsToday, 2); assert.equal(context.totalTipsToday, 2);
    assert.equal(stats.testTodayMm, 6.4); assert.equal(context.testTodayMm, 6.4);
    assert.equal(stats.recordedTodayMm, 7.29); assert.equal(stats.recordedTipsToday, 12);
    const daily = await new RainfallService().getDailyRainfall(id, 2, now);
    assert.equal(daily.at(-1)?.rainfallMm, stats.todayMm);
    const hourly = await new RainfallService().getHourlyRainfall(id, 24, now);
    assert.equal(hourly.at(-1)?.hour, '14:00');
    const report = await new AiService().chat('tổng lượng mưa hôm nay', [], id);
    assert.match(report.reply, /0,89 mm/); assert.match(report.reply, /Nước thử tách riêng: 6,4 mm/);
    assert.doesNotMatch(report.reply, /mưa rất to/);
  });
  it('quarantines overlapping batches without fabricating timestamps or altering stored raw events', async () => {
    const id = 'BATCH-TEST'; await station(id);
    const from = '2026-11-03T07:00:00.000Z', to = '2026-11-03T07:01:00.000Z';
    const e = await event(id, '2026-11-03T07:02:00.000Z', 3, 0.64, '2026-11-03T06:59:00.000Z');
    const period = await dataStore.saveRainTestPeriod({ deviceId: id, from, to, note: 'thử một phần lô', createdBy: 'operator' });
    const classified = classifyRainEvents([e!], [period]);
    assert.equal(classified[0].dataKind, 'test'); assert.equal(classified[0].tipCount, 3);
    assert.equal((await dataStore.getRainEvents(id))[0].dataKind, undefined);
    assert.equal((await readRainLedger(id, undefined, now.toISOString()))[0].intervalFrom, '2026-11-03T06:59:00.000Z');
  });
  it('keeps a clock boundary event in exactly one adjacent rain report', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const id = 'CLOCK-RAIN'; await station(id); await event(id, '2026-11-03T07:00:00.000Z', 1);
    const ai = new AiService();
    const earlier = await ai.chat('lượng mưa từ 13:00 đến 14:00 hôm nay', [], id);
    const later = await ai.chat('lượng mưa từ 14:00 đến 14:30 hôm nay', [], id);
    assert.equal(earlier.context.observationReport?.rain.tips, 0);
    assert.equal(later.context.observationReport?.rain.tips, 1);
  });
  it('persists telemetry before deduplicating and never deletes rain history on sequence numbers or counter resets', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const id = 'MQTT-COUNTER';
    const send = (index: number, tips: number, reset = 0) => handleTelemetryMessage(`weather/${id}/telemetry`, JSON.stringify({ deviceId: id, messageId: `${id}-${index}`, timestamp: new Date(now.getTime() - (10 - index) * 1000).toISOString(), temperature: 30, humidity: 60, pressure: 1010, totalRainTips: tips, sequenceNumber: index, rain_reset_sequence: reset, uptime: 100 + index }));
    await send(1, 0); await send(2, 2); await send(2, 2); await send(3, 0, 1); await send(4, 1, 1);
    const measurements = await dataStore.getMeasurements(id);
    const events = await dataStore.getRainEvents(id);
    assert.equal(measurements.length, 4);
    assert.equal(events.reduce((s, e) => s + e.tipCount, 0), 3);
    assert.equal(events.length, 2); assert.equal(events[0].timingQuality, 'telemetry_interval');
    assert.equal(events[0].intervalFrom, measurements[0].timestamp);
    assert.equal((await new RainfallService().getStatistics(id)).totalTipsToday, 3);
  });
  it('does not double-count a direct tip message and a telemetry snapshot of the same cumulative counter', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const id = 'DIRECT-COUNTER'; await station(id);
    const timestamp = now.toISOString();
    await handleRainEventMessage(`weather/${id}/rain`, JSON.stringify({ deviceId: id, messageId: `${id}-tip`, bootId: 'boot', sequenceNumber: 1, timestamp, tipCount: 1, cumulativeTips: 1 }));
    await handleTelemetryMessage(`weather/${id}/telemetry`, JSON.stringify({ deviceId: id, messageId: `${id}-snapshot`, bootId: 'boot', sequenceNumber: 2, timestamp, totalRainTips: 1, temperature: 30, humidity: 60, pressure: 1010, uptime: 100 }));
    const events = await dataStore.getRainEvents(id);
    assert.equal(events.length, 1); assert.equal(events[0].timingQuality, 'device_tip'); assert.equal(events[0].tipCount, 1);
  });
  it('keeps simulated rain tagged after leaving DEMO mode', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const id = 'SIMULATED-RAIN'; await station(id);
    await handleRainEventMessage(`weather/${id}/rain`, JSON.stringify({ deviceId: id, messageId: `${id}-tip`, bootId: 'boot', sequenceNumber: 1, timestamp: now.toISOString(), tipCount: 3, cumulativeTips: 3 }), true);
    const raw = await dataStore.getRainEvents(id);
    assert.equal(raw[0].dataKind, 'test');
    const stats = await new RainfallService().getStatistics(id);
    assert.equal(stats.todayMm, 0); assert.equal(stats.testTodayMm, 1.92); assert.equal(stats.currentRateMmH, 0);
  });
  it('resumes from a persisted counter but treats first, reset and late snapshots as baselines, not newly timed tips', (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const at = now.getTime();
    assert.equal(advanceRainCounter('FIRST', { tips: 100, timestamp: new Date(at).toISOString() }), null);
    const persisted = { id: 'x', deviceId: 'RESTART', messageId: 'x', createdAt: now.toISOString(), timestamp: new Date(at - 1000).toISOString(), temperature: 30, humidity: 60, pressure: 1010, wifiRssi: -60, uptime: 10, totalRainTips: 10 };
    assert.equal(advanceRainCounter('RESTART', { tips: 12, timestamp: now.toISOString(), uptime: 11 }, persisted)?.increment, 2);
    assert.equal(advanceRainCounter('RESTART', { tips: 1, timestamp: new Date(at + 1000).toISOString(), uptime: 1 }), null);
    assert.equal(advanceRainCounter('RESTART', { tips: 100, timestamp: new Date(at - 5000).toISOString(), uptime: 10 }), null);
    assert.equal(advanceRainCounter('RESTART', { tips: 2, timestamp: new Date(at + 2000).toISOString(), uptime: 2 })?.increment, 1);
  });
  it('preserves history when startup seeding runs again', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const id = 'SEED-HISTORY'; await station(id); await event(id, now.toISOString(), 1); await measurement(id, now.toISOString());
    await seedInitialData();
    assert.equal((await dataStore.getRainEvents(id)).length, 1);
    assert.equal((await dataStore.getMeasurements(id)).length, 1);
  });
  it('requires ADMIN authentication, validates intervals, records a test and stops a live session through HTTP', async () => {
    const app = express(); app.use(express.json());
    app.get('/devices/:id/rain-audit', rainAuditController.list);
    app.post('/devices/:id/rain-test-periods', authenticate, rainAuditController.create);
    app.post('/devices/:id/rain-test-periods/all-recorded', authenticate, rainAuditController.markAllRecorded);
    app.patch('/devices/:id/rain-test-periods/:periodId/stop', authenticate, rainAuditController.stop);
    const server = app.listen(0, '127.0.0.1');
    try {
      await new Promise<void>((resolve) => server.once('listening', resolve));
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/devices/HTTP-TEST`;
      const body = { from: new Date(Date.now() - 60000).toISOString(), to: new Date(Date.now() + 60000).toISOString(), note: 'Thử HTTP' };
      const post = (token?: string, payload = body) => fetch(`${url}/rain-test-periods`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) });
      assert.equal((await post()).status, 401);
      assert.equal((await post(generateToken({ id: 'viewer', email: 'v@test', role: 'VIEWER' }))).status, 403);
      const token = generateToken({ id: 'admin', email: 'a@test', role: 'ADMIN' });
      assert.equal((await fetch(`${url}/rain-test-periods/all-recorded`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })).status, 503);
      assert.equal((await post(token, { ...body, to: body.from })).status, 400);
      const result = await post(token); assert.equal(result.status, 201);
      const { data } = await result.json();
      const stop = await fetch(`${url}/rain-test-periods/${data.id}/stop`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
      assert.equal(stop.status, 200);
      assert.equal((await (await fetch(`${url}/rain-audit`)).json()).data.periods.length, 1);
    } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
  });
});
