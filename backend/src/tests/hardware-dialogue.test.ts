import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { generateRainSenseReply, normalizeStationContext, RAIN_SENSE_POLICY } from '../shared/rainsense-ai';
import { getProjectKnowledgeReply, isProjectExplanationQuery, searchProjectDocs } from '../shared/project-knowledge';
import { resolveChatQuestion } from '../shared/chat-context';
import { AiService } from '../services/ai.service';
import { env } from '../config/env';

const now = new Date('2026-11-09T04:49:38Z');
const c = normalizeStationContext({ stationName: 'Trạm hội thoại', observedAt: now.toISOString(), isOnline: true,
  currentTemp: 32.2, currentHumid: 48.6, currentPress: 1019.5, todayRainMm: 45.44, currentRainRateMmH: 0, calibrationFactor: 0.64 }, 'DIALOGUE');

describe('Mechanism questions never become weather snapshots', () => {
  const questions: Array<[string, RegExp, RegExp]> = [
    ['làm sao để đo được nhiệt độ', /BMP180/, /I2C/],
    ['lam sao de do duoc nhiet do', /BMP180/, /DHT11/],
    ['Trạm đo nhiệt độ bằng gì?', /BMP180/, /cảm biến/],
    ['Nhiệt độ được đo bằng cách nào?', /I2C/, /MQTT/],
    ['Trạm hoạt động như nào?', /phễu|Phễu/, /MQTT/],
    ['Hệ thống hoạt động thế nào?', /ESP32-S3/, /backend/i],
    ['Mạch và phụ kiện của trạm gồm những gì?', /ESP32-S3/, /Nguồn|nguồn/],
    ['Các linh kiện có vai trò gì?', /Hall/, /phễu|Phễu/],
    ['Làm thế nào để đo được độ ẩm?', /DHT11/, /checksum/],
    ['Độ ẩm đo bằng gì?', /DHT11/, /%RH/],
    ['DHT11 hoạt động thế nào?', /điện trở polymer/, /không phải I2C/],
    ['Đo áp suất khí quyển bằng gì?', /áp điện trở/, /I2C/],
    ['BMP180 hoạt động thế nào?', /ADC|analog–số/, /hPa/],
    ['OLED có tác dụng gì?', /hiển thị tại chỗ/, /không thay thế/],
    ['Nguồn của trạm có vai trò gì?', /GND/, /điện áp/]
  ];
  for (const [question, a, b] of questions) it(question, () => {
    const reply = generateRainSenseReply(question, c, [], now);
    assert.match(reply, a); assert.match(reply, b);
    assert.doesNotMatch(reply, /Theo báo cáo từ trạm|32\.2|48\.6|1019\.5|45\.44|cửa sổ 5 phút/);
    assert.ok(reply.trim().split(/\s+/).length <= 180);
  });
  it('retrieves the temperature mechanism rather than an unrelated meteorological paragraph', () => {
    assert.equal(isProjectExplanationQuery('làm sao để đo được nhiệt độ'), true);
    assert.equal(searchProjectDocs('làm sao để đo được nhiệt độ')[0].id, 'measurement-principles-0');
    assert.match(getProjectKnowledgeReply('Độ ẩm tương đối là gì?', c)!, /bão hòa/);
    assert.match(getProjectKnowledgeReply('Cách cấp nguồn BMP180 5 V?', c)!, /1,8–3,6 V/);
    assert.match(getProjectKnowledgeReply('DHT11 cấp nguồn 3,3 V được không?', c)!, /3,3–5,5 V/);
  });
  it('respects configured BME280 hardware and distinguishes code from the physical station', () => {
    const reply = getProjectKnowledgeReply('Làm sao để đo được nhiệt độ?', { ...c, profile: { hardwareVariant: 'rainsense-s3', wiringVerified: false, environmentSensors: 'bme280' } })!;
    assert.match(reply, /Theo hồ sơ trạm.*BME280/); assert.match(reply, /đối chiếu firmware đã nạp/);
    assert.doesNotMatch(reply, /ưu tiên BMP180/);
    assert.match(generateRainSenseReply('Làm sao đo nhiệt độ?', normalizeStationContext({}), [], now), /Trong mã IOT_MQTT_TLS/);
  });
  it('does not inherit a forecast date or old report interval for a new mechanism question', () => {
    const q = resolveChatQuestion('Vậy làm sao để đo được nhiệt độ?', [{ role: 'user', content: 'Dự báo nhiệt độ ngày mai' }]);
    assert.doesNotMatch(q, /Dự báo|ngày mai/);
    assert.match(generateRainSenseReply(q, c, [], now), /I2C/);
    const pronoun = resolveChatQuestion('Vậy đo bằng gì?', [{ role: 'user', content: 'Nhiệt độ hôm qua bao nhiêu?' }]);
    assert.match(pronoun, /nhiệt độ/); assert.doesNotMatch(pronoun, /hôm qua/);
    assert.match(generateRainSenseReply(pronoun, c, [], now), /BMP180/);
    assert.match(resolveChatQuestion('Nó đo bằng cách nào?', [{ role: 'user', content: 'BMP180 là gì?' }]), /bmp180/i);
  });
  it('keeps the canonical prompt identical to the runtime prompt and includes the complete policy', () => {
    const prompt = readFileSync(path.resolve(__dirname, '../../../docs/ai/rainsense-system-prompt.txt'), 'utf8').replace(/\r\n/g, '\n').trim();
    assert.equal(RAIN_SENSE_POLICY, prompt);
    for (const phrase of ['làm sao để đo được nhiệt độ', 'DỮ LIỆU CHƯA ĐẦY ĐỦ', 'GẦU LẬT', 'DỰ ĐOÁN NGUY CƠ', 'THỬ NƯỚC', 'đẹp trời', 'BMP180', 'phụ kiện']) assert.ok(prompt.includes(phrase), phrase);
  });
});

describe('Hardware answers without a configured or available model', () => {
  it('answers the exact screenshot question as sourced knowledge with no model key or weather query', async (t) => {
    const old = env.GEMINI_API_KEY; env.GEMINI_API_KEY = '';
    const ai = new AiService();
    t.mock.method(ai, 'getLiveContext', async () => ({ ...c, dataQuality: { source: 'memory', generatedAt: now.toISOString(), demo: false, fresh: true, historyTruncated: false } }));
    t.mock.method(ai, 'getObservationReport', async () => { throw Error('A mechanism question must not query weather history'); });
    t.mock.method(globalThis, 'fetch', async () => { throw Error('Local knowledge does not need a model call'); });
    try {
      const result = await ai.chat('làm sao để đo được nhiệt độ', [], c.deviceId);
      assert.equal(result.metadata.mode, 'knowledge'); assert.equal(result.metadata.provider, 'local');
      assert.equal(result.metadata.fallbackReason, undefined); assert.match(result.reply, /BMP180/); assert.match(result.reply, /I2C/);
      assert.ok(result.metadata.sources.some((s) => s.id === 'measurement-principles-0'));
      assert.doesNotMatch(result.reply, /45\.44|bộ nhớ dự phòng|chưa ghi nhận nhịp/);
      const current = await ai.chat('nhiệt độ hiện tại bao nhiêu?', [], c.deviceId);
      assert.equal(current.metadata.mode, 'analysis'); assert.match(current.reply, /32\.2 °C/);
      assert.doesNotMatch(current.reply, /checksum|bằng cảm biến/);
    } finally { env.GEMINI_API_KEY = old; }
  });
  it('still answers from approved hardware documents when a configured model fails', async (t) => {
    const old = env.GEMINI_API_KEY; env.GEMINI_API_KEY = 'test-only-key';
    const ai = new AiService(); t.mock.method(ai, 'getLiveContext', async () => c);
    t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 429 }));
    try {
      const result = await ai.chat('Trạm hoạt động như nào?', [], c.deviceId);
      assert.equal(result.metadata.mode, 'knowledge'); assert.equal(result.metadata.provider, 'local');
      assert.match(result.reply, /MQTT/); assert.match(result.reply, /Hall/); assert.doesNotMatch(result.reply, /test-only-key|45\.44/);
    } finally { env.GEMINI_API_KEY = old; }
  });
});
