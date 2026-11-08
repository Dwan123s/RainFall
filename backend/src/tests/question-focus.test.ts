import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStationContext, generateRainSenseReply } from '../shared/rainsense-ai';
import { getProjectKnowledgeReply, searchProjectDocs } from '../shared/project-knowledge';
import { knowledgeQuestionTopics, isMeasurementMethodQuestion } from '../shared/question-intent';
import { resolveChatQuestion } from '../shared/chat-context';
import { AiService } from '../services/ai.service';
import { env } from '../config/env';
import { dataStore } from '../db/store';

const now = new Date('2026-11-09T05:21:33Z');
const c = normalizeStationContext({ isOnline: true, observedAt: now.toISOString(), currentTemp: 25, currentHumid: 60, currentPress: 1019.5, todayRainMm: 91.52, currentRainRateMmH: 76.8, totalTipsToday: 143, calibrationFactor: 0.25 }, 'FOCUS');
const answer = (q: string) => generateRainSenseReply(q, c, [], now);

describe('Purpose is distinct from operating mechanism', () => {
  for (const q of ['dự án này dùng để làm gì', 'mục đích của trạm là gì?', 'Trạm này có mục tiêu gì?', 'Ứng dụng của RainSense là gì?', 'Lợi ích của hệ thống này?', 'RainSense giải quyết vấn đề gì?']) it(q, () => {
    assert.ok(knowledgeQuestionTopics(q).includes('purpose'));
    assert.equal(searchProjectDocs(q)[0].id, 'project-overview-2');
    const text = answer(q);
    assert.match(text, /giúp theo dõi/); assert.match(text, /từ xa/); assert.match(text, /lưu lịch sử/);
    assert.doesNotMatch(text, /gầu|Hall|200 ms|P =|91.52|76.8/);
  });
  it('answers both purpose and operation when both are explicitly requested', () => {
    const text = answer('Mục đích và cách hoạt động của trạm là gì?');
    assert.match(text, /giúp theo dõi/); assert.match(text, /MQTT/); assert.match(text, /Hall/);
    assert.deepEqual(knowledgeQuestionTopics('Hall trong trạm dùng để làm gì?'), []);
    assert.match(answer('Hall trong trạm dùng để làm gì?'), /Hall|từ trường/);
  });
});

describe('Rain measurement questions are not live rain reports', () => {
  for (const q of ['đo lượng mưa như nào', 'do luong mua nhu nao', 'Đo mưa ra sao?', 'Tính lượng mưa như thế nào?', 'Cách đo lượng mưa?', 'Công thức tính lượng mưa là gì?', 'Lượng mưa được đo bằng cách nào?']) it(q, () => {
    assert.ok(knowledgeQuestionTopics(q).includes('rain-method'));
    const text = answer(q);
    assert.match(text, /Phễu/); assert.match(text, /Hall A3144/); assert.match(text, /P = N × k/); assert.match(text, /I = P × 60 \/ t/);
    assert.match(text, /Ví dụ giả định/);
    assert.doesNotMatch(text, /91\.52|76\.8|143 nhịp|cập nhật lúc|nguy cơ ngập/);
  });
  it('still treats a question about today rainfall as a measured quantity', () => {
    assert.deepEqual(knowledgeQuestionTopics('Lượng mưa hôm nay như nào?'), []);
    assert.equal(isMeasurementMethodQuestion('Độ ẩm hôm nay như nào?'), false);
    assert.equal(getProjectKnowledgeReply('Lượng mưa hôm nay như nào?', c), null);
    assert.match(answer('Lượng mưa hôm nay như nào?'), /91\.52 mm/);
    assert.doesNotMatch(answer('Lượng mưa hôm nay như nào?'), /P = N × k/);
  });
});

describe('Individual weather metrics have relevant interpretations', () => {
  const examples: Array<[string, RegExp, RegExp]> = [
    ['Nhiệt độ không khí bao nhiêu thì thời tiết mát mẻ?', /18–24 °C/, /quy ước/],
    ['Độ ẩm bao nhiêu là cao?', /RH là độ ẩm tương đối/, /70–85%/],
    ['Áp suất bao nhiêu thì bình thường?', /1013,25 hPa/, /độ cao/],
    ['Nhiệt độ hiện tại có mát không?', /25.0 °C/, /dễ chịu/],
    ['Độ ẩm thì sao?', /60.0 %/, /mức vừa/],
    ['Áp suất thì như nào?', /1019.5 hPa/, /khí áp tại trạm/]
  ];
  for (const [q, a, b] of examples) it(q, () => {
    const text = answer(q); assert.match(text, a); assert.match(text, b);
    assert.doesNotMatch(text, /91\.52|76\.8|P = N|gầu|nhịp lật/);
    if (/Độ ẩm/.test(q)) assert.doesNotMatch(text, /1019\.5 hPa/);
    if (/Áp suất/.test(q)) assert.doesNotMatch(text, /25\.0 °C|60\.0 %/);
  });
  it('interprets a supplied value as the user scenario, not the current station reading', () => {
    const t = answer('Nhiệt độ 32°C có nóng không?'); assert.match(t, /bộ số bạn cung cấp/); assert.match(t, /khá nóng/); assert.doesNotMatch(t, /25\.0 °C/);
    const h = answer('Độ ẩm 80% thì sao?'); assert.match(h, /RH 80%/); assert.match(h, /khá cao/); assert.doesNotMatch(h, /60\.0 %/);
    const p = answer('Áp suất 1013 hPa thì sao?'); assert.match(p, /bộ số bạn cung cấp/); assert.match(p, /cùng độ cao/); assert.doesNotMatch(p, /1019\.5 hPa|chắc chắn.*mưa/);
  });
  it('keeps concept follow-ups distinct from current-reading follow-ups and forecast dates', () => {
    const guide = resolveChatQuestion('Còn độ ẩm thì sao?', [{ role: 'user', content: 'Nhiệt độ bao nhiêu thì mát?' }]);
    assert.ok(knowledgeQuestionTopics(guide).includes('humidity-guide')); assert.match(answer(guide), /35–70%/);
    const reading = resolveChatQuestion('Còn độ ẩm thì sao?', [{ role: 'user', content: 'Nhiệt độ hiện tại bao nhiêu?' }]);
    assert.match(answer(reading), /60.0 %/); assert.doesNotMatch(answer(reading), /25.0 °C/);
    const purpose = resolveChatQuestion('Vậy dự án này dùng để làm gì?', [{ role: 'user', content: 'Dự báo thời tiết ngày mai' }]);
    assert.doesNotMatch(purpose, /Dự báo|ngày mai/); assert.match(answer(purpose), /giúp theo dõi/);
    const method = resolveChatQuestion('Còn đo lượng mưa như nào?', [{ role: 'user', content: 'Dự báo lượng mưa ngày mai' }]);
    assert.doesNotMatch(method, /Dự báo|ngày mai/); assert.match(answer(method), /P = N × k/);
  });
  it('uses temperature, RH, pressure and recent rain together for an everyday weather question', () => {
    const rain = { label: '1 giờ trượt', from: new Date(now.getTime() - 3600000).toISOString(), to: now.toISOString(), rainfallMm: 100, tips: 100, calibrationFactors: [1], coverageComplete: true, uncertainTimingEvents: 0 };
    const text = generateRainSenseReply('Thời tiết hôm nay thì sao?', { ...c, currentTemp: 34, currentHumid: 80, rainWindows: [rain] }, [], now);
    assert.match(text, /nóng và oi ẩm/); assert.match(text, /RH 80%/); assert.match(text, /khí áp/); assert.match(text, /100 mm\/h/); assert.match(text, /ngập cục bộ có thể cao/);
    assert.doesNotMatch(text, /P = N × k|đang xảy ra lũ|chắc chắn.*nắng/);
  });
});

describe('Backend chooses focused replies even without a language model', () => {
  it('routes both screenshot questions to sourced knowledge and the date question to real readings', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const old = env.GEMINI_API_KEY; env.GEMINI_API_KEY = '';
    const ai = new AiService(); t.mock.method(ai, 'getLiveContext', async () => ({ ...c, dataQuality: { source: 'postgresql', generatedAt: now.toISOString(), demo: false, fresh: true, historyTruncated: false } }));
    t.mock.method(globalThis, 'fetch', async () => { throw Error('No model required for these intents'); });
    try {
      for (const [q, id] of [['dự án này dùng để làm gì', 'project-overview-2'], ['đo lượng mưa như nào', 'rain-calibration-3']]) {
        const result = await ai.chat(q, [], 'FOCUS'); assert.equal(result.metadata.mode, 'knowledge'); assert.ok(result.metadata.sources.some((s) => s.id === id)); assert.doesNotMatch(result.reply, /91\.52|76\.8/);
      }
      const hypothetical = await ai.chat('Nhiệt độ 32°C có nóng không?', [], 'FOCUS'); assert.match(hypothetical.reply, /bộ số bạn cung cấp/); assert.match(hypothetical.reply, /khá nóng/);
      const actual = await ai.chat('Áp suất thì như nào?', [], 'FOCUS'); assert.equal(actual.metadata.mode, 'analysis'); assert.match(actual.reply, /1019.5 hPa/);
    } finally { env.GEMINI_API_KEY = old; }
  });
  it('does not turn an explicit one-hour measurement request into a generic definition', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const id='FOCUS-HOUR'; await dataStore.upsertDevice({deviceId:id,name:id});
    await dataStore.saveMeasurement({deviceId:id,messageId:'m',timestamp:now.toISOString(),temperature:25,humidity:80,pressure:1010,uptime:1,wifiRssi:-50});
    const result=await new AiService().chat('Độ ẩm 1 giờ vừa qua như nào?',[],id);
    assert.equal(result.metadata.mode,'analysis');assert.ok(result.context.observationReport);assert.match(result.reply,/80 %/);assert.match(result.reply,/khá cao/);
    assert.doesNotMatch(result.reply,/35–70%|Chưa đủ chuỗi khí áp/);
  });
});
