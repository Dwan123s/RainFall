import type { StationContext } from './rainsense-ai';
import { foldText } from './project-knowledge';
import { hasFutureTime } from './time-request';
import { calculateDewPoint } from './utils/weather-calc';
import { observationMetrics } from './observation-request';
import { describeRainWindow, nearestRainWindow, rainNumber, isWaterTestQuery } from './rain-interpretation';
import { isMeasurementMethodQuestion, knowledgeQuestionTopics, isMetricEvaluationQuestion } from './question-intent';
import { temperatureInterpretation, humidityInterpretation, pressureInterpretation } from './metric-interpretation';

export function isStationAnalysisQuery(query: string): boolean {
  const q = foldText(query);
  if (isMeasurementMethodQuestion(query) || knowledgeQuestionTopics(query).length) return false;
  if (/ngung|ngun|tanh|mua lai|sang.*chieu|chieu.*sang/.test(q) && !/nguy co|ngap|lu lut|sat lo/.test(q)) return false;
  if (/la gi|cach|nguyen ly|tai sao|vi sao|hieu chuan/.test(q) || hasFutureTime(q)) return false;
  return /nguy co|ngap|lu lut|lu quet|sat lo|mua\s+(?:nhieu|it|to|nho)\b|mua.*(?:nhu nao|the nao)|phan tich|nhan dinh|danh gia|du doan|du bao.*(?:thong so|cam bien)|(?:thong so|cam bien).*du bao/.test(q) && /thoi tiet|moi truong|mua|nhiet do|do am|khi ap|ap suat|cam bien|thong so|ngap|lu lut|lu quet|sat lo/.test(q);
}

/** Available observations first; a missing pressure trend never blocks rain or other sensors. */
export function stationAnalysis(c: StationContext, now = new Date(), options: { includeRain?: boolean; historical?: boolean; testing?: boolean } = {}): string {
  const f = c.weatherFeatures;
  const lines: string[] = [];
  const evidence: string[] = [];
  const t = f?.temperatureDelta1hC;
  const p = f?.pressureDelta3hHpa;
  const signed = (n: number) => (n > 0 ? '+' : '') + n;
  if (t != null) evidence.push('nhiệt độ đổi ' + signed(t) + ' °C trong 1 giờ');
  else if (f?.temperature?.firstValue !== undefined && f.temperature.lastValue !== undefined && (f.temperature.sampleCount ?? 0) >= 2) evidence.push('nhiệt độ chênh đầu–cuối ' + signed(Number((f.temperature.lastValue - f.temperature.firstValue).toFixed(2))) + ' °C giữa các mốc đã đo');
  if (p != null) evidence.push('khí áp đổi ' + signed(p) + ' hPa trong 3 giờ');
  else if (f?.pressure?.firstValue !== undefined && f.pressure.lastValue !== undefined && (f.pressure.sampleCount ?? 0) >= 2) evidence.push('khí áp chênh đầu–cuối ' + signed(Number((f.pressure.lastValue - f.pressure.firstValue).toFixed(2))) + ' hPa giữa các mốc đã đo');
  if (evidence.length) lines.push('Quan trắc cho thấy ' + evidence.join('; ') + '.');
  if (c.dataQuality?.demo) return lines.join(' ') + ' Các số này là giả lập, không nhận định thời tiết thực tế.';
  if (options.includeRain !== false) {
    const rain = nearestRainWindow(c);
    if (rain) lines.push(describeRainWindow(rain, { testing: options.testing, timezone: c.timezone }));
    const hours = c.rainHistory?.hourly?.slice(-2) ?? [];
    if (!options.testing && hours.length === 2 && hours.every((w) => w.coverageComplete && !w.uncertainTimingEvents && Date.parse(w.to) - Date.parse(w.from) === 3600000) && hours[0].to === hours[1].from) lines.push(`Hai giờ liền kề ghi ${hours[0].rainfallMm} rồi ${hours[1].rainfallMm} mm; lượng theo giờ ${hours[1].rainfallMm > hours[0].rainfallMm ? 'tăng' : hours[1].rainfallMm < hours[0].rainfallMm ? 'giảm' : 'bằng nhau'} trong các khoảng đã đo.`);
  }
  if (c.currentHumid !== null && c.currentHumid >= 90 && (t != null && t < 0 || f?.temperature?.firstValue !== undefined && f.temperature.lastValue !== undefined && f.temperature.lastValue < f.temperature.firstValue)) lines.push('RH cao cùng nhiệt độ giảm gợi ý không khí tiến gần bão hòa; nếu tiếp tục lạnh đi có thể thuận lợi cho ngưng tụ.');
  else if (c.currentTemp !== null && (c.dewPoint !== null || c.currentHumid !== null && c.currentHumid > 0)) {
    const dew = c.dewPoint ?? calculateDewPoint(c.currentTemp, c.currentHumid!);
    const spread = Number((c.currentTemp - dew).toFixed(1));
    lines.push('Nhiệt độ cách điểm sương khoảng ' + spread + ' °C' + (spread <= 2 ? ', không khí gần bão hòa; nếu tiếp tục lạnh đi có thể thuận lợi cho ngưng tụ.' : '; riêng trạng thái này chưa gợi ý không khí sát bão hòa hoặc xác định giờ mưa.'));
  } else if (c.currentHumid !== null) lines.push(c.currentHumid >= 90 ? 'RH cao cho thấy không khí ẩm; nếu tiếp tục lạnh đi có thể tiến gần bão hòa, nhưng RH không phải độ ẩm đất.' : 'RH mô tả độ ẩm không khí tại thời điểm đo, thay đổi theo nhiệt độ.');
  else if (c.currentPress !== null && !evidence.length) lines.push('Một giá trị khí áp mô tả trạng thái tại trạm; cần mốc so sánh mới xác định được tăng/giảm, không suy bão từ riêng số này.');
  if (options.includeRain !== false && (c.testTodayMm ?? 0) > 0 && !nearestRainWindow(c)?.testRainfallMm) lines.push('Có ' + c.testTodayMm + ' mm nước thử được tách riêng, không dùng để nhận định thời tiết.');
  const age = c.observedAt ? now.getTime() - Date.parse(c.observedAt) : NaN;
  if (!options.historical && (!c.isOnline || !Number.isFinite(age) || age < -60000 || age > 300000)) lines.push('Đây là phân tích bản ghi gần nhất đang cũ/ngoại tuyến, chưa xác nhận điều kiện đang diễn ra.');
  return lines.join(' ');
}

export function stationAnalysisReply(c: StationContext, now = new Date(), query = 'phân tích thời tiết hiện tại'): string {
  if (c.currentTemp === null && c.currentHumid === null && c.currentPress === null && c.todayRainMm === null && !c.rainWindows?.length && !c.weatherFeatures?.availableSampleCount && !c.weatherFeatures?.sampleCount) return 'Trạm chưa có báo cáo quan trắc môi trường hợp lệ để phân tích. Nếu bạn cung cấp số liệu và thời điểm, mình có thể phân tích như tình huống do bạn nêu.';
  const metrics = observationMetrics(foldText(query));
  const include = (metric: typeof metrics[number]) => !metrics.length || metrics.includes(metric);
  const at = c.observedAt ? new Date(c.observedAt).toLocaleString('vi-VN', { timeZone: c.timezone, hour12: false }) : 'chưa xác định thời điểm';
  const values = [!include('temperature') || c.currentTemp === null ? '' : 'nhiệt độ ' + c.currentTemp.toFixed(1) + ' °C', !include('humidity') || c.currentHumid === null ? '' : 'độ ẩm ' + c.currentHumid.toFixed(1) + ' %', !include('pressure') || c.currentPress === null ? '' : 'khí áp ' + c.currentPress.toFixed(1) + ' hPa'].filter(Boolean);
  const rain = include('rain') && c.todayRainMm !== null ? ' Trạm ghi nhận hôm nay ' + c.todayRainMm.toFixed(2) + ' mm' + (c.totalTipsToday === null ? '' : ' (' + c.totalTipsToday + ' nhịp)') + '; tổng ngày không phải cường độ hiện tại.' : '';
  const rate = include('rain') && !nearestRainWindow(c) && c.currentRainRateMmH !== null ? c.currentRainRateMmH === 0 ? ' Chưa ghi nhận nhịp lật mới trong cửa sổ 5 phút; chưa thể khẳng định đã tạnh hoàn toàn.' : ' Cường độ quy đổi 5 phút ' + rainNumber(c.currentRainRateMmH) + ' mm/h; chưa có mốc từng nhịp để đối chiếu cường độ này.' : '';
  const focused = { ...c, currentTemp: include('temperature') ? c.currentTemp : null, currentHumid: include('humidity') ? c.currentHumid : null, currentPress: include('pressure') ? c.currentPress : null, weatherFeatures: c.weatherFeatures ? { ...c.weatherFeatures, temperatureDelta1hC: include('temperature') ? c.weatherFeatures.temperatureDelta1hC : null, pressureDelta3hHpa: include('pressure') ? c.weatherFeatures.pressureDelta3hHpa : null, temperature: include('temperature') ? c.weatherFeatures.temperature : null, pressure: include('pressure') ? c.weatherFeatures.pressure : null } : undefined };
  const q = foldText(query);
  let hazard = '';
  if (/ngap|lu lut|lu quet|sat lo|thien tai/.test(q) && !isWaterTestQuery(query) && !c.dataQuality?.demo) {
    if (/ngung|ngun|tanh|het nguy co/.test(q) || c.currentRainRateMmH === 0) hazard += ' Sau khi mưa giảm, nước thượng nguồn có thể tiếp tục về; không thể kết luận đã hết nguy cơ ngập.';
    if (/lu quet|sat lo|thien tai/.test(q)) hazard += ' Nếu ở lưu vực dốc, gần suối hoặc đất đã ướt, mưa lớn tiếp diễn có thể tăng nguy cơ lũ quét, sạt lở; độ ẩm không khí không phải độ ẩm đất.';
    if (!nearestRainWindow(c)) hazard += ' Nếu mưa lớn tiếp tục, có thể quá tải thoát nước tại nơi trũng/thoát kém; đây là nhận định nguy cơ có điều kiện, chưa xác nhận đang ngập.';
  }
  return 'Theo báo cáo từ trạm ' + c.stationName + ' (' + c.deviceId + '), cập nhật lúc ' + at + (values.length ? ', ' + values.join(', ') : '') + '.' + rain + rate + '\n\n' + stationAnalysis(focused, now, { includeRain: include('rain'), testing: isWaterTestQuery(query) }) + hazard;
}

export function getSensorScenarioReply(query: string): string | null {
  const q = foldText(query);
  if (!/phan tich|nhan dinh|du bao|du doan|mua khong|sap mua|co mua|co chac/.test(q) && !isMetricEvaluationQuestion(query)) return null;
  if (isMeasurementMethodQuestion(query) || knowledgeQuestionTopics(query).length) return null;
  const n = '(-?\\d+(?:[.,]\\d+)?)';
  const temps = Array.from(q.matchAll(new RegExp(`${n}\\s*(?:°\\s*c|do\\s*c)`, 'g')));
  const humidity = Array.from(q.matchAll(new RegExp(`${n}\\s*%`, 'g')));
  const pressure = Array.from(q.matchAll(new RegExp(`${n}\\s*(hpa|pa)\\b`, 'g')));
  if (![temps, humidity, pressure].some((list) => list.length)) return null;
  if ([temps, humidity, pressure].some((list) => list.length > 1)) return 'Bạn đang đưa nhiều mốc số liệu. Hãy gắn thời điểm cho từng bộ nhiệt độ/RH/khí áp để so sánh xu hướng; mình chưa coi các số này là bản ghi tại trạm.';
  const parse = (s: string) => Number(s.replace(',', '.'));
  const t = temps[0] ? parse(temps[0][1]) : null;
  const h = humidity[0] ? parse(humidity[0][1]) : null;
  const p = pressure[0] ? parse(pressure[0][1]) / (pressure[0][2] === 'pa' ? 100 : 1) : null;
  if (t !== null && (t < -40 || t > 85) || h !== null && (h < 0 || h > 100) || p !== null && (p < 300 || p > 1100)) return 'Bộ số bạn cung cấp có giá trị ngoài khoảng kiểm tra của RainSense. Hãy kiểm tra °C, %RH, hPa/Pa và giá trị cảm biến trước khi phân tích; mình chưa thay chúng vào số đo của trạm.';
  const values = [t === null ? '' : `${t} °C`, h === null ? '' : `RH ${h}%`, p === null ? '' : `${p} hPa`].filter(Boolean);
  let text = `Theo bộ số bạn cung cấp (${values.join(', ')}), chưa đối chiếu với trạm: `;
  if (isMetricEvaluationQuestion(query)) {
    const parts = [t === null ? '' : temperatureInterpretation(t, h), h === null ? '' : humidityInterpretation(h), p === null ? '' : pressureInterpretation()].filter(Boolean);
    return text + parts.join(' ');
  }
  if (t !== null && h !== null && h > 0) {
    const dew = calculateDewPoint(t, h);
    text += `điểm sương khoảng ${dew} °C, cách nhiệt độ ${Number((t - dew).toFixed(1))} °C. `;
    text += t - dew <= 2 ? 'Không khí gần bão hòa; nếu tiếp tục lạnh đi, có thể thuận lợi cho ngưng tụ/sương. ' : 'Không khí chưa sát bão hòa theo chênh lệch điểm sương; riêng điều này không loại trừ mưa do điều kiện ở trên cao. ';
  } else if (h !== null) text += h >= 90 ? 'Không khí có RH cao; nếu tiếp tục lạnh đi có thể tiến gần bão hòa, nhưng đây không phải độ ẩm đất. ' : 'RH mô tả độ ẩm không khí và phụ thuộc nhiệt độ, không phải độ ẩm đất. ';
  else if (t !== null) text += 'Nhiệt độ mô tả trạng thái nhiệt tại thời điểm bạn nêu; khi có RH có thể tính thêm điểm sương để xét mức gần bão hòa. ';
  else text += 'Khí áp tại trạm chịu ảnh hưởng độ cao; không coi 1013,25 hPa là mốc cố định để suy bão. ';
  text += 'Một bộ số chưa xác định xu hướng hoặc giờ mưa; đây là nhận định sơ bộ, cập nhật khi có mốc mới.';
  return text;
}
