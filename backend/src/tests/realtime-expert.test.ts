import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AiService } from '../services/ai.service';
import { dataStore } from '../db/store';
import { summarizeRainWindow } from '../services/ai-rain-history';
import { calculateWeatherFeatures } from '../services/ai-weather-features';
import { normalizeStationContext, generateRainSenseReply } from '../shared/rainsense-ai';
import { describeRainWindow, getRainScenarioReply, isWaterTestQuery, nearestRainWindow, rainRateAssessment } from '../shared/rain-interpretation';
import { formatObservationReport } from '../shared/observation-report';
import { getWeatherFeatureReply } from '../shared/project-knowledge';
import { env } from '../config/env';
import type { RainEventRecord } from '../shared/types/rain';
import { getWeatherSummaryReply, isWeatherSummaryQuery } from '../shared/weather-summary';

const now = new Date('2026-11-09T06:00:00Z');
const start = new Date(now.getTime() - 3600000);
const at = (minutes: number) => new Date(now.getTime() - minutes * 60000).toISOString();
const telemetry = (length = 61) => Array.from({ length }, (_, i) => at(i));
const event = (rainfallMm: number, overrides: Partial<RainEventRecord> = {}): RainEventRecord => ({ id: 'e', eventId: 'e', deviceId: 'TEST', timestamp: at(10), rainfallMm, tipCount: rainfallMm, calibrationFactor: 1, timingQuality: 'device_tip', createdAt: at(10), ...overrides });
const summarize = (events: RainEventRecord[], samples = telemetry()) => summarizeRainWindow(events, samples, start, now, '1 giờ vừa qua', 120000, true);

describe('Everyday weather summaries', () => {
  const mild = normalizeStationContext({ currentTemp: 25, currentHumid: 60, isOnline: true, observedAt: now.toISOString(), todayRainMm: 0, rainWindows: [{ ...summarize([]), label: '1 giờ trượt' }] }, 'SUMMARY');
  it('answers a pleasant-weather question with a qualified natural headline and measured values', () => {
    const text = getWeatherSummaryReply('Hôm nay đẹp trời không?', mild, now)!;
    assert.match(text, /^Lúc này có thể xem là khá đẹp trời xét riêng nhiệt độ và độ ẩm/);
    assert.match(text, /25 °C, RH 60%/); assert.match(text, /chưa đo mây, nắng và gió/);
    assert.doesNotMatch(text, /trời nắng|trời quang đãng|chắc chắn.*không mưa/);
  });
  it('describes heat and moisture instead of calling high pressure or low RH proof of fair skies', () => {
    const text = getWeatherSummaryReply('Thời tiết hôm nay thế nào?', { ...mild, currentTemp: 34, currentHumid: 55, currentPress: 1015 }, now)!;
    assert.match(text, /^Hiện tại, điều kiện khá nóng và oi ẩm/);
    assert.doesNotMatch(text, /đẹp trời|trời nắng/);
    const muggy = getWeatherSummaryReply('Hôm nay đẹp trời không?', { ...mild, currentTemp: 29, currentHumid: 80 }, now)!;
    assert.match(muggy, /ấm và khá ẩm/); assert.doesNotMatch(muggy, /có thể xem là khá đẹp trời/);
  });
  it('distinguishes recent heavy rain, earlier daily rain and unverified backfills', () => {
    const rain = { ...summarize([event(100)]), label: '1 giờ trượt' };
    const wet = getWeatherSummaryReply('Thời tiết hôm nay có mưa không?', { ...mild, todayRainMm: 100, rainWindows: [rain] }, now)!;
    assert.match(wet, /^Gần đây trạm có ghi nhận mưa/); assert.match(wet, /100 mm\/h/); assert.match(wet, /nguy cơ ngập cục bộ có thể cao/i);
    const earlier = getWeatherSummaryReply('Hôm nay thời tiết thế nào?', { ...mild, todayRainMm: 20 }, now)!;
    assert.match(earlier, /^Hôm nay trạm đã ghi nhận mưa/); assert.match(earlier, /chưa ghi nhận nhịp mới/);
    assert.doesNotMatch(earlier, /đang mưa|khá đẹp trời/);
    const batch = getWeatherSummaryReply('Thời tiết thế nào?', { ...mild, rainWindows: [{ ...rain, uncertainTimingEvents: 1 }] }, now)!;
    assert.match(batch, /lô nhịp chưa rõ giờ/); assert.doesNotMatch(batch, /100 mm\/h|mưa rất to/);
  });
  it('does not label stale, missing, simulated or test water as present natural rain', () => {
    const stale = getWeatherSummaryReply('Hôm nay đẹp trời không?', { ...mild, observedAt: at(1440) }, now)!;
    assert.match(stale, /^Bản ghi gần nhất/); assert.match(stale, /Số đo đã cũ/); assert.doesNotMatch(stale, /có thể xem là khá đẹp trời/);
    assert.match(getWeatherSummaryReply('Thời tiết thế nào?', normalizeStationContext({}), now)!, /chưa có số đo/);
    const pressureOnly = getWeatherSummaryReply('Thời tiết hôm nay thế nào?', normalizeStationContext({ currentPress: 1013 }), now)!;
    assert.match(pressureOnly, /khí áp 1\.?013 hPa/); assert.doesNotMatch(pressureOnly, /chưa có số đo|khá đẹp trời/);
    assert.match(getWeatherSummaryReply('Hôm nay đẹp trời không?', { ...mild, dataQuality: { source: 'memory', generatedAt: now.toISOString(), fresh: true, demo: true, historyTruncated: false } }, now)!, /^Đây là số liệu giả lập/);
    const test = getWeatherSummaryReply('Thời tiết thế nào, tôi đang xả nước thử?', { ...mild, rainWindows: [{ ...summarize([event(100)]), label: '1 giờ trượt' }] }, now)!;
    assert.match(test, /thử nước/); assert.doesNotMatch(test, /Gần đây trạm có ghi nhận mưa|mưa rất to|ngập cục bộ/);
  });
  it('keeps exact reports, forecasts and hardware questions on their original routes', () => {
    for (const q of ['nhiệt độ thời tiết hôm nay', 'Thời tiết 1 giờ vừa qua', 'Thời tiết hôm qua thế nào?', 'Thời tiết thứ hai thế nào?', 'Thời tiết hôm kia thế nào?', 'Thời tiết ngày mai thế nào?', 'Cảm biến thời tiết hoạt động thế nào?', 'Báo cáo thời tiết hôm nay', 'Phân tích thời tiết hiện tại', 'Thời tiết mưa 10 mm thì gầu lật bao nhiêu lần?']) assert.equal(isWeatherSummaryQuery(q), false, q);
    assert.equal(isWeatherSummaryQuery('Hôm nay có mưa không?'), true);
    assert.equal(isWeatherSummaryQuery('Trời hôm nay như nào?'), true);
    assert.match(generateRainSenseReply('Hôm nay đẹp trời không?', mild, [], now), /^Lúc này có thể xem là khá đẹp trời/);
  });
  it('answers the everyday today question before the daily statistics or model routes', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const ai = new AiService(); t.mock.method(ai, 'getLiveContext', async () => mild);
    t.mock.method(ai, 'getObservationReport', async () => { throw Error('An everyday summary should not turn into a table'); });
    t.mock.method(globalThis, 'fetch', async () => { throw Error('An everyday summary does not need a model'); });
    const response = await ai.chat('Thời tiết hôm nay thế nào?', [], 'SUMMARY');
    assert.equal(response.metadata.mode, 'analysis'); assert.match(response.reply, /^Lúc này có thể xem là khá đẹp trời/);
    assert.equal(response.context.observationReport, undefined);
  });
});

describe('Realtime RainSense acceptance cases', () => {
  it('interprets 100 mm in a measured hour as a conditional flood risk without confirming a flood', () => {
    const text = describeRainWindow(summarize([event(100)]));
    assert.match(text, /100 mm\/h trong 60 phút/);
    assert.match(text, /nguy cơ ngập cục bộ có thể cao/i);
    assert.match(text, /nơi trũng hoặc thoát nước kém/);
    assert.doesNotMatch(text, /đang (?:ngập|lũ)|cấp [1-5]|\d+%|Nước thử tách riêng: 0/);
  });
  it('analyses the available continuous 20 minutes rather than requiring a whole hour', () => {
    const w = summarize([event(12)], telemetry(21));
    assert.equal(w.coverageComplete, false);
    assert.equal(w.observedSegments?.length, 1);
    const text = describeRainWindow(w);
    assert.match(text, /20 phút/); assert.match(text, /12 mm, trung bình 36 mm\/h cho đoạn đó/);
    assert.match(text, /chỉ là phần đã lưu/);
    assert.doesNotMatch(text, /12 mm\/h|đủ 1 giờ|có thể cao/);
  });
  it('uses a recorded lower bound across outages without pretending telemetry or rain was continuous', () => {
    const w = summarize([event(100)], [at(60), at(0)]);
    assert.equal(w.observedSegments?.length, 0);
    const text = describeRainWindow(w);
    assert.match(text, /tối thiểu 100 mm\/h trên cửa sổ yêu cầu/);
    assert.match(text, /không giả định mưa liên tục/);
    assert.doesNotMatch(text, /Riêng đoạn liên tục|Trung bình 100 mm\/h/);
  });
  it('does not infer hourly intensity from a daily total of 37.12 mm / 58 tips', () => {
    const w = { ...summarize([event(37.12, { tipCount: 58 })]), label: 'hôm nay' };
    const text = formatObservationReport({ from: start.toISOString(), to: now.toISOString(), label: 'hôm nay', metrics: ['rain'], rain: w, weather: calculateWeatherFeatures([], start, now, 120000), generatedAt: now.toISOString(), historyTruncated: false }, normalizeStationContext({}, 'TEST'), 'lượng mưa hôm nay như nào');
    assert.match(text, /^Trong hôm nay, trạm ghi nhận 37,12 mm \(58 nhịp\)/);
    assert.match(text, /tích lũy.*đáng chú ý/);
    assert.doesNotMatch(text, /37,12 mm\/h|Nước thử tách riêng: 0|Gầu chưa xác minh/);
  });
  it('separates test water and demo without converting them into a real weather hazard', () => {
    const w = summarize([event(100, { dataKind: 'test' })]);
    assert.equal(w.rainfallMm, 0); assert.equal(w.testRainfallMm, 100);
    const test = describeRainWindow(w);
    assert.match(test, /Nước thử tách riêng: 100 mm/); assert.doesNotMatch(test, /có thể cao|mưa rất to/);
    const demo = describeRainWindow(summarize([event(100)]), { demo: true });
    assert.match(demo, /giả lập/); assert.doesNotMatch(demo, /có thể cao|nguy cơ ngập/);
    const unlabelled = describeRainWindow(summarize([event(100)]), { testing: true });
    assert.match(unlabelled, /Theo bạn mô tả đây là thử nước/); assert.doesNotMatch(unlabelled, /có thể cao/);
  });
  it('supports an aggregate bounded within a window but refuses an unbounded backfill intensity', () => {
    const bounded = summarize([event(100, { timingQuality: 'telemetry_interval', intervalFrom: at(15) })]);
    assert.equal(bounded.uncertainTimingEvents, 0);
    assert.match(describeRainWindow(bounded), /100 mm\/h/);
    const crossing = summarize([event(100, { timingQuality: 'telemetry_interval', intervalFrom: at(90) })]);
    assert.equal(crossing.uncertainTimingEvents, 1);
    assert.doesNotMatch(describeRainWindow(crossing), /100 mm\/h|có thể cao/);
    assert.match(describeRainWindow(crossing), /chưa biết giờ chính xác/);
  });
  it('labels user rainfall separately and accepts Vietnamese written durations', () => {
    for (const duration of ['1 giờ', 'một tiếng', '60 phút']) {
      const text = getRainScenarioReply(`Mưa 100 mm trong ${duration} có nguy cơ ngập không?`)!;
      assert.match(text, /Theo số liệu bạn cung cấp/); assert.match(text, /100 mm\/h/); assert.match(text, /nguy cơ ngập cục bộ có thể cao/i);
      assert.match(text, /không xác nhận đang xảy ra lũ/);
    }
    assert.doesNotMatch(getRainScenarioReply('Tôi xả nước thử 100 mm trong 1 giờ có ngập không?')!, /có thể cao/);
    assert.equal(getRainScenarioReply('Báo cáo mưa 1 giờ, tôi nhớ có 100 mm'), null);
    assert.equal(getRainScenarioReply('100 mm trong 1 giờ tương đương bao nhiêu lần gầu lật?'), null);
    assert.match(getRainScenarioReply('Mưa 100 mm/h có nguy cơ ngập không?')!, /cường độ 100 mm\/h/);
  });
  it('does not erase recent hour risk just because the last five minutes contain no tips', () => {
    const hour = { ...summarize([event(100)]), label: '1 giờ trượt' };
    const short = { ...summarize([]), label: '5 phút trượt' };
    const c = normalizeStationContext({ rainWindows: [short, hour] });
    assert.equal(nearestRainWindow(c), hour);
    assert.match(describeRainWindow(nearestRainWindow(c)!), /100 mm\/h/);
  });
  it('makes a short intensity spike conditional on persistence, rather than claiming an hour-long storm', () => {
    const text = rainRateAssessment(100, 5);
    assert.match(text, /Nếu cường độ này duy trì/);
    assert.match(text, /một cửa sổ ngắn chưa chứng minh/);
    assert.doesNotMatch(text, /Nguy cơ ngập cục bộ có thể cao/);
  });
  it('does not treat a request to exclude tests as proof all remaining water was a test', () => {
    assert.equal(isWaterTestQuery('Lượng mưa hôm nay đã loại thử nước chưa?'), false);
    assert.equal(isWaterTestQuery('Mưa hiện tại không phải thử nước'), false);
    assert.equal(isWaterTestQuery('Tôi vừa xả nước thử'), true);
  });
  it('describes a single valid sensor state without manufacturing a trend or demanding all sensors', () => {
    const c = normalizeStationContext({ currentHumid: 95, isOnline: true, observedAt: now.toISOString() });
    const text = generateRainSenseReply('Phân tích độ ẩm hiện tại', c, [], now);
    assert.match(text, /95.0 %/); assert.match(text, /nếu tiếp tục lạnh đi/);
    assert.doesNotMatch(text, /khí áp|chưa có báo cáo|khí áp đổi|nhiệt độ đổi|Chưa có chuỗi/);
  });
  it('allows pressure endpoint differences across a gap without claiming a continuous 3-hour trend', () => {
    const records = [60, 0].map((m, i) => ({ id: String(i), messageId: String(i), deviceId: 'P', timestamp: at(m), createdAt: at(m), temperature: 30 - i, humidity: -999, pressure: 1010 - i, uptime: 1, wifiRssi: -50 }));
    const weatherFeatures = calculateWeatherFeatures(records, start, now, 120000);
    assert.equal(weatherFeatures.sampleCount, 0);
    const reply = getWeatherFeatureReply('khí áp thay đổi bao nhiêu', normalizeStationContext({ weatherFeatures }))!;
    assert.match(reply, /chênh đầu–cuối -1 hPa/); assert.match(reply, /không tự coi khoảng thiếu là liên tục/);
    assert.doesNotMatch(reply, /Chưa đủ chuỗi khí áp/);
  });
  it('answers a rain-only station even when every environment sensor is missing', () => {
    const text = generateRainSenseReply('Phân tích mưa hiện tại', normalizeStationContext({ todayRainMm: 100, rainWindows: [{ ...summarize([event(100)]), label: '1 giờ trượt' }], observedAt: now.toISOString(), isOnline: true }), [], now);
    assert.match(text, /100.00 mm/); assert.match(text, /ngập cục bộ có thể cao/);
    assert.doesNotMatch(text, /chưa có báo cáo quan trắc/);
  });
  it('retains useful historical interpretation while marking stale readings', () => {
    const text = generateRainSenseReply('Phân tích nhiệt độ độ ẩm hiện tại', normalizeStationContext({ currentTemp: 28, currentHumid: 95, isOnline: false, observedAt: at(1440) }), [], now);
    assert.match(text, /28.0 °C/); assert.match(text, /gần bão hòa/); assert.match(text, /bản ghi gần nhất đang cũ/);
    assert.doesNotMatch(text, /chưa dùng để nhận định/);
  });
});

describe('Realtime service without a language model', () => {
  it('reports a partially observed hour with valid temperature, RH and rain even if pressure fails', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const id = 'RT-PARTIAL'; await dataStore.upsertDevice({ deviceId: id, name: id });
    for (let i = 0; i <= 20; i++) await dataStore.saveMeasurement({ deviceId: id, messageId: `r-${i}`, timestamp: at(i), temperature: 30 - (20 - i) / 20, humidity: 80 + (20 - i) / 2, pressure: -999, uptime: 1, wifiRssi: -50 });
    await dataStore.saveRainEvent({ deviceId: id, eventId: 'r', timestamp: at(10), tipCount: 12, calibrationFactor: 1, timingQuality: 'device_tip' });
    const text = (await new AiService().chat('Phân tích nhiệt độ độ ẩm áp suất lượng mưa 1 giờ vừa qua', [], id)).reply;
    for (const pattern of [/Nhiệt độ: trung bình/, /Độ ẩm: trung bình/, /Áp suất: chưa có/, /12 mm/, /36 mm\/h/, /nhiệt độ chênh đầu–cuối -1 °C/, /gần bão hòa/]) assert.match(text, pattern);
    assert.doesNotMatch(text, /Chưa đủ chuỗi khí áp|chưa có báo cáo quan trắc/);
  });
  it('refreshes persisted readings on every turn and never trusts quantities in chat history', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const id = 'RT-FRESH'; await dataStore.upsertDevice({ deviceId: id, name: id });
    for (const stamp of telemetry()) await dataStore.saveMeasurement({ deviceId: id, messageId: stamp, timestamp: stamp, temperature: 30, humidity: 60, pressure: 1010, uptime: 1, wifiRssi: -50 });
    const ai = new AiService();
    await dataStore.saveRainEvent({ deviceId: id, eventId: 'first', timestamp: at(10), tipCount: 50, calibrationFactor: 1, timingQuality: 'device_tip' });
    assert.match((await ai.chat('lượng mưa 1 giờ vừa qua', [], id)).reply, /50 mm \(50 nhịp\)/);
    await dataStore.saveRainEvent({ deviceId: id, eventId: 'second', timestamp: at(1), tipCount: 50, calibrationFactor: 1, timingQuality: 'device_tip' });
    const second = await ai.chat('lượng mưa 1 giờ vừa qua', [{ role: 'assistant', content: 'Tổng 999 mm' }], id);
    assert.match(second.reply, /100 mm \(100 nhịp\)/); assert.match(second.reply, /ngập cục bộ có thể cao/); assert.doesNotMatch(second.reply, /999 mm/);
    assert.ok(second.reply.indexOf('100 mm') < second.reply.indexOf('bộ nhớ dự phòng'));
  });
  it('offers qualitative sensor interpretation when location-based forecasts are unavailable', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const id = 'RT-NO-LOCATION'; await dataStore.upsertDevice({ deviceId: id, name: id });
    await dataStore.saveMeasurement({ deviceId: id, messageId: 'latest', timestamp: now.toISOString(), temperature: 28, humidity: 96, pressure: 1008, uptime: 1, wifiRssi: -50 });
    await dataStore.updateDeviceStatus(id, true, now.toISOString());
    const key = env.GEMINI_API_KEY;
    try {
      env.GEMINI_API_KEY = '';
      t.mock.method(globalThis, 'fetch', async () => { throw Error('No external call without a configured location'); });
      const r = await new AiService().chat('Dự báo thời tiết 1 giờ tới', [], id);
      assert.equal(r.metadata.mode, 'forecast'); assert.match(r.reply, /28.0 °C/); assert.match(r.reply, /gần bão hòa/); assert.match(r.reply, /Chưa có dự báo bên ngoài hợp lệ/);
      assert.equal(r.metadata.provider, 'local'); assert.deepEqual(r.metadata.sources, []);
      assert.doesNotMatch(r.reply, /xác suất \d|sẽ mưa lúc/);
    } finally { env.GEMINI_API_KEY = key; }
  });
  it('keeps an hourly pressure interpretation focused on pressure', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const id = 'RT-PRESSURE-ONLY'; await dataStore.upsertDevice({ deviceId: id, name: id });
    for (let i = 0; i <= 60; i++) await dataStore.saveMeasurement({ deviceId: id, messageId: String(i), timestamp: at(i), temperature: 25, humidity: 99, pressure: 1009 + i / 60, uptime: 1, wifiRssi: -50 });
    const { reply } = await new AiService().chat('Phân tích áp suất 1 giờ vừa qua', [], id);
    assert.match(reply, /Áp suất: trung bình/); assert.match(reply, /khí áp chênh đầu–cuối -1 hPa/);
    assert.doesNotMatch(reply, /điểm sương|gần bão hòa|nhiệt độ|độ ẩm|\d+ mm/);
  });
});
