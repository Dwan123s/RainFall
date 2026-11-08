import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateRainSenseReply, normalizeStationContext, buildRainSensePrompt } from '../shared/rainsense-ai';
import { getProjectKnowledgeReply, searchProjectDocs } from '../shared/project-knowledge';
import { getCalibrationReply } from '../shared/rain-calibration';
import { stationAnalysis, getSensorScenarioReply } from '../shared/station-analysis';
import { resolveChatQuestion } from '../shared/chat-context';
import { wantsDetailedAnswer } from '../shared/answer-style';
import { AiService } from '../services/ai.service';
import { env } from '../config/env';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ForecastService, forecastReply } from '../services/ai-forecast.service';

const now = new Date('2026-11-09T03:00:00Z');
const base = normalizeStationContext({ stationName: 'Trạm thử', observedAt: now.toISOString(), isOnline: true, currentTemp: 28, currentHumid: 94, currentPress: 1008, dewPoint: 27, calibrationFactor: 0.64, testTodayMm: 6.4,
  weatherFeatures: { from: '2026-11-09T00:00:00Z', to: now.toISOString(), sampleCount: 181, invalidSampleCount: 0, coverageComplete: true, temperature: null, humidity: null, pressure: null, temperatureDelta1hC: -1.2, pressureDelta3hHpa: -1.5 } }, 'EXPERT');
const words = (s: string) => s.trim().split(/\s+/).length;

describe('RainSense expert knowledge and focused answers', () => {
  const questions = [
    ['Dự án hiện dùng cảm biến nào?', /BMP180/, /DHT11/],
    ['BMP180 có đo độ ẩm không?', /không đo độ ẩm/, /BME280/],
    ['Điện trở kéo lên I2C có tác dụng gì?', /open-drain/, /điện trở kéo lên/],
    ['Vì sao cần mass GND chung?', /mốc tham chiếu/, /ESP32-S3/],
    ['Gầu lệch và khóa đếm 200 ms ảnh hưởng thế nào?', /cân|lệch/, /200 ms/],
    ['Áp suất 1013 hPa có chắc trời đẹp không?', /1013,25/, /không phải ranh giới/],
    ['Vì sao nhiệt độ giảm mà RH tăng?', /lạnh đi/, /hơi nước/],
    ['BME280 tự nóng trên PCB làm nhiệt độ sai không?', /PCB/, /không tự bảo đảm/],
    ['Cờ bme280_found có chứng minh mạch dùng BME280 không?', /cờ tổng hợp/, /BMP|bmpOk/],
    ['DHT11 được nối chân GPIO nào trong bản OLED?', /GPIO4/, /Chưa xác minh/]
  ] as const;
  for (const [q, a, b] of questions) it(q, () => {
    const text = getProjectKnowledgeReply(q, base);
    assert.ok(text, q); assert.match(text!, a); assert.match(text!, b);
    assert.ok(words(text!) <= 180, `Default answer too long: ${words(text!)} words`);
  });
  it('keeps power guidance separate when the user asks about both BME280 and A3144', () => {
    const reply = generateRainSenseReply('Nguồn BME280 và A3144 khác nhau thế nào?', base, [], now);
    assert.match(reply, /1,71–3,6 V/); assert.match(reply, /4,5–24 V/); assert.match(reply, /open-collector/);
  });
  it('uses curated project and manufacturer sources and can expand only when requested', () => {
    const q = 'Giải thích chi tiết gầu lật, phễu và nam châm hoạt động thế nào';
    const detailed = getProjectKnowledgeReply(q, base)!;
    const brief = getProjectKnowledgeReply('Gầu lật và nam châm hoạt động thế nào?', base)!;
    assert.ok(detailed.length >= brief.length); assert.equal(wantsDetailedAnswer(q), true);
    assert.equal(wantsDetailedAnswer('Tóm tắt ngắn dù nội dung chuyên sâu'), false);
    assert.ok(searchProjectDocs('Điện trở kéo lên I2C làm gì?').some((d) => d.source.includes('espressif.com')));
    assert.match(buildRainSensePrompt(base), /BMP180 \+ DHT11/);
    assert.match(buildRainSensePrompt(base), /60–130 từ/);
  });
  it('retains one hardware subject in a pronoun follow-up without inventing readings', () => {
    const q = resolveChatQuestion('Nó có đo độ ẩm không?', [{ role: 'user', content: 'BMP180 là gì?' }]);
    assert.match(q, /bmp180/i);
    assert.match(generateRainSenseReply(q, base, [], now), /không đo độ ẩm/);
  });
  it('honors an explicitly configured sensor package rather than replacing it with repository defaults', () => {
    const reply = getProjectKnowledgeReply('Trạm hiện dùng cảm biến nào?', { ...base, profile: { hardwareVariant: 'oled-s3', wiringVerified: false, environmentSensors: 'bme280' } })!;
    assert.match(reply, /Theo hồ sơ trạm/); assert.match(reply, /là BME280/);
    assert.doesNotMatch(reply, /là BMP180 \+ DHT11/);
  });
  it('checks firmware facts behind the curated manifest without emitting firmware credentials', () => {
    const source = readFileSync(path.resolve(__dirname, '../../../firmware/IOT_MQTT_TLS/IOT_MQTT_TLS.ino'), 'utf8');
    assert.equal(source.includes('#include <Adafruit_BMP085.h>'), true);
    assert.equal(source.includes('#include <DHT.h>'), true);
    assert.equal(source.match(/#define DHT_PIN\s+(\d+)/)?.[1], '4');
    assert.equal(source.match(/#define HALL_PIN\s+(\d+)/)?.[1], '10');
    assert.equal(source.match(/DEBOUNCE_DELAY\s*=\s*(\d+)/)?.[1], '200');
  });
});

describe('Weather interpretation and calibration as an expert', () => {
  it('combines measured trends, excludes tests and gives a qualitative interpretation without invented probabilities', () => {
    const reply = stationAnalysis(base, now);
    assert.match(reply, /-1.2 °C trong 1 giờ/); assert.match(reply, /-1.5 hPa trong 3 giờ/);
    assert.match(reply, /gần bão hòa/); assert.match(reply, /6.4 mm nước thử/);
    assert.doesNotMatch(reply, /\d+%|chắc chắn.*mưa|mưa lúc/);
    assert.ok(words(reply) <= 160);
  });
  it('uses partial observations without manufacturing a continuous trend, and flags stale data', () => {
    const c = { ...base, observedAt: '2026-11-08T03:00:00Z', weatherFeatures: { ...base.weatherFeatures!, temperatureDelta1hC: null, pressureDelta3hHpa: null } };
    const reply = stationAnalysis(c, now);
    assert.match(reply, /gần bão hòa/); assert.match(reply, /đang cũ/);
    assert.doesNotMatch(reply, /khí áp đổi|nhiệt độ đổi/);
  });
  it('labels user-provided values as a scenario and checks units and physical bounds', () => {
    const reply = getSensorScenarioReply('30°C, RH 90%, áp suất 100000 Pa thì có mưa không?')!;
    assert.match(reply, /bộ số bạn cung cấp/); assert.match(reply, /1000 hPa/); assert.match(reply, /chưa đối chiếu với trạm/);
    assert.match(reply, /chưa xác định xu hướng/);
    assert.match(getSensorScenarioReply('Phân tích 30°C, độ ẩm 120%, áp suất 1000 hPa')!, /ngoài khoảng/);
    assert.equal(getSensorScenarioReply('Báo cáo nhiệt độ 1 giờ, tôi nhớ có 20 mm'), null);
  });
  it('calculates calibration from volume, collecting area or circular diameter', () => {
    assert.match(getCalibrationReply('Hiệu chuẩn 100 mL, diện tích 100 cm², đếm 20 nhịp')!, /0.5 mm\/lần/);
    assert.match(getCalibrationReply('Tính hệ số hiệu chuẩn với 100 ml, đường kính 10 cm, 20 lần')!, /0.6366198 mm\/lần/);
    assert.match(getCalibrationReply('Hiệu chuẩn 100 ml, diện tích 100 cm², 0 nhịp')!, /nguyên dương/);
    assert.match(getCalibrationReply('Hiệu chuẩn 100 ml và 20 nhịp')!, /diện tích/);
  });
  it('answers sensor-based interpretation and calibration before a configured model or external forecast', async (t) => {
    const oldKey = env.GEMINI_API_KEY;
    t.mock.method(globalThis, 'fetch', async () => { throw Error('Should not request external generation'); });
    const service = new AiService(); t.mock.method(service, 'getLiveContext', async () => structuredClone(base));
    try {
      env.GEMINI_API_KEY = 'test-only';
      assert.equal((await service.chat('Dự báo thời tiết dựa vào thông số cảm biến', [], 'EXPERT')).metadata.mode, 'analysis');
      assert.equal((await service.chat('Hiệu chuẩn 100 ml, 100 cm², 20 nhịp', [], 'EXPERT')).metadata.mode, 'calculation');
    } finally { env.GEMINI_API_KEY = oldKey; }
  });
  it('gives the model a short-answer instruction and a separate budget for explicit detail', async (t) => {
    const key = env.GEMINI_API_KEY; const bodies: any[] = [];
    t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => { bodies.push(JSON.parse(String(init.body))); return Response.json({ candidates: [{ content: { parts: [{ text: 'Câu trả lời kỹ thuật.' }] } }] }); });
    try {
      env.GEMINI_API_KEY = 'test-only'; const ai = new AiService();
      await ai.chat('BMP180 khác BME280 thế nào?', [], 'STYLE'); await ai.chat('Giải thích chi tiết BMP180 khác BME280 thế nào?', [], 'STYLE');
      assert.match(bodies[0].systemInstruction.parts[0].text, /60–130 từ/);
      assert.ok(bodies[0].generationConfig.maxOutputTokens < bodies[1].generationConfig.maxOutputTokens);
      assert.match(bodies[0].systemInstruction.parts[0].text, /knowledge_context/);
    } finally { env.GEMINI_API_KEY = key; }
  });
  it('routes sensor capability questions to project expertise rather than the rain-forecast branch', async () => {
    const key = env.GEMINI_API_KEY;
    try {
      env.GEMINI_API_KEY = '';
      const result = await new AiService().chat('BME280 có đo lượng mưa không?', [], 'EXPERT-ROUTING');
      assert.equal(result.metadata.mode, 'knowledge'); assert.equal(result.context.forecast, undefined);
      assert.match(result.reply, /không đo lượng mưa/);
      const report = await new AiService().chat('Nhiệt độ BMP180 trong 1 tiếng', [], 'EXPERT-ROUTING');
      assert.equal(report.metadata.mode, 'analysis'); assert.ok(report.context.observationReport);
    } finally { env.GEMINI_API_KEY = key; }
  });
  it('keeps telemetry notices out of hardware explanations and user-supplied scenarios', async (t) => {
    const key = env.GEMINI_API_KEY; const ai = new AiService();
    t.mock.method(ai, 'getLiveContext', async () => ({ ...structuredClone(base), dataQuality: { source: 'memory', generatedAt: now.toISOString(), demo: true, fresh: true, historyTruncated: false } }));
    try {
      env.GEMINI_API_KEY = '';
      const hardware = await ai.chat('Điện trở kéo lên I2C làm gì?', [], 'EXPERT');
      assert.doesNotMatch(hardware.reply, /bộ nhớ dự phòng|chế độ giả lập/);
      const scenario = await ai.chat('Phân tích 30°C, RH 90%, áp suất 1000 hPa', [], 'EXPERT');
      assert.doesNotMatch(scenario.reply, /bộ nhớ dự phòng|chế độ giả lập/);
      assert.match(scenario.reply, /bộ số bạn cung cấp/);
    } finally { env.GEMINI_API_KEY = key; }
  });
  it('forecasts the requested pressure and humidity with checked units and a focused response', async (t) => {
    const first = Date.parse('2026-11-09T00:00:00Z') / 1000;
    t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
      assert.match(String(url), /surface_pressure/);
      return Response.json({ hourly_units: { time: 'unixtime', temperature_2m: '°C', relative_humidity_2m: '%', surface_pressure: 'hPa', precipitation: 'mm', precipitation_probability: '%' },
        hourly: { time: Array.from({ length: 96 }, (_, i) => first + i * 3600), temperature_2m: Array(96).fill(28), relative_humidity_2m: Array(96).fill(84), surface_pressure: Array(96).fill(1008), precipitation: Array(96).fill(0.5), precipitation_probability: Array(96).fill(60) } });
    });
    const f = await new ForecastService().getForecast('Dự báo ngày mai', { hardwareVariant: 'unknown', wiringVerified: false, latitude: 16, longitude: 108 }, base.timezone, now);
    assert.equal(f.status, 'available'); assert.equal(f.periods[0].pressureHpa, 1008);
    const reply = forecastReply(f, base, 'Dự báo áp suất và độ ẩm ngày mai');
    assert.match(reply, /1008 hPa/); assert.match(reply, /84 %/);
    assert.doesNotMatch(reply, /Nhiệt độ|Tổng giáng thủy/);
    assert.ok(words(reply) <= 150);
    const detail = forecastReply(f, base, 'Dự báo chi tiết áp suất ngày mai');
    assert.match(detail, /1008 hPa/); assert.doesNotMatch(detail, /°C/);
  });
});
