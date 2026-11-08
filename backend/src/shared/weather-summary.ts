import type { StationContext } from './rainsense-ai';
import { normalizeTimePhrase, parseTimeDuration, hasFutureTime } from './time-request';
import { calculateDewPoint } from './utils/weather-calc';
import { nearestRainWindow, isWaterTestQuery, rainNumber, rainRateAssessment } from './rain-interpretation';
import { temperatureFeeling, pressureInterpretation } from './metric-interpretation';
import { isMeasurementMethodQuestion, knowledgeQuestionTopics } from './question-intent';

/** Everyday weather questions get a short interpretation, rather than a table of all sensors. */
export function isWeatherSummaryQuery(query: string): boolean {
  const q = normalizeTimePhrase(query);
  if (isMeasurementMethodQuestion(query) || knowledgeQuestionTopics(query).length) return false;
  if (!/thoi tiet|dep troi|troi.*(?:hom nay|the nao|nhu nao)|hom nay.*(?:co mua|mua khong)|(?:co mua|mua khong).*hom nay/.test(q)) return false;
  if (/hom kia|thu (?:hai|ba|tu|nam|sau|bay)|chu nhat/.test(q)) return false;
  if (hasFutureTime(q) || parseTimeDuration(q).status !== 'none') return false;
  return !/gau|nhip|quy doi|cong thuc|luong mua|du bao|phan tich|chi tiet|bao cao|trung binh|cao nhat|thap nhat|xu huong|nhiet do|do am|ap suat|khi ap|la gi|tai sao|vi sao|nguyen ly|hieu chuan|hoat dong|mach|phan cung|cam bien|chatbot|du an|mqtt|esp32|linh kien|hom qua|tuan|thang|ngay\s+\d|\d+[/-]\d+|\btu\s+\d|\bluc\s+\d|sang nay|chieu nay|toi nay|ca ngay|suot ngay/.test(q);
}

export function getWeatherSummaryReply(query: string, c: StationContext, now = new Date()): string | null {
  if (!isWeatherSummaryQuery(query)) return null;
  if (c.currentTemp === null && c.currentHumid === null && c.currentPress === null && c.todayRainMm === null && !c.rainWindows?.length) return 'Trạm chưa có số đo để mô tả thời tiết. Bạn có thể đưa nhiệt độ, độ ẩm hoặc lượng mưa vừa đo để mình nhận xét ngay phần đó.';
  if (c.dataQuality?.demo) return `Đây là số liệu giả lập${c.currentTemp === null ? '' : `: ${rainNumber(c.currentTemp)} °C`}${c.currentHumid === null ? '' : `, RH ${rainNumber(c.currentHumid)}%`}; chưa dùng để kết luận hôm nay đẹp trời hay đang mưa thực tế.`;
  const age = c.observedAt ? now.getTime() - Date.parse(c.observedAt) : NaN;
  const fresh = c.isOnline && Number.isFinite(age) && age >= -60000 && age <= 300000;
  const t = c.currentTemp, rh = c.currentHumid;
  const dew = t !== null && rh !== null && rh > 0 ? calculateDewPoint(t, rh) : null;
  const thermal = t === null ? rh === null ? '' : rh >= 85 ? 'không khí khá ẩm' : 'đã có số đo độ ẩm không khí' : temperatureFeeling(t, rh);
  const w = nearestRainWindow(c);
  const windowAge = w ? now.getTime() - Date.parse(w.to) : NaN;
  const usableWindow = w && windowAge >= -60000 && windowAge <= 300000 && Date.parse(w.to) > Date.parse(w.from) ? w : undefined;
  const testing = isWaterTestQuery(query);
  const wet = !testing && usableWindow && usableWindow.rainfallMm > 0;
  const zero = !testing && usableWindow?.coverageComplete && usableWindow.rainfallMm === 0;
  const pleasant = fresh && zero && t !== null && t >= 18 && t <= 30 && rh !== null && rh >= 35 && dew !== null && dew < 18 && (c.todayRainMm ?? 0) === 0;
  const lines: string[] = [];
  if (!fresh) lines.push(`Bản ghi gần nhất cho thấy${thermal ? ` điều kiện ${thermal}` : ' phần số liệu đã đo'}.`);
  else if (wet) lines.push(`Gần đây trạm có ghi nhận mưa${thermal ? `, không khí ${thermal}` : ''}.`);
  else if ((c.todayRainMm ?? 0) > 0 && !testing) lines.push(`Hôm nay trạm đã ghi nhận mưa${thermal ? `; lúc này ${thermal}` : ''}.`);
  else if (pleasant) lines.push('Lúc này có thể xem là khá đẹp trời xét riêng nhiệt độ và độ ẩm; trạm chưa ghi nhận nhịp mưa trong cửa sổ gần nhất.');
  else if (thermal) lines.push(`${fresh ? 'Hiện tại' : 'Theo bản ghi'}, điều kiện ${thermal}.`);
  const values = [t === null ? '' : `${rainNumber(t)} °C`, rh === null ? '' : `RH ${rainNumber(rh)}%`, c.currentPress !== null ? `khí áp ${rainNumber(c.currentPress)} hPa` : ''].filter(Boolean);
  if (values.length) lines.push(`Trạm đo ${values.join(', ')}.`);
  if (c.weatherFeatures?.pressureDelta3hHpa != null) lines.push(pressureInterpretation(c.weatherFeatures.pressureDelta3hHpa));
  if (t === null && rh === null && c.currentPress !== null) lines.push('Riêng khí áp chưa cho biết trời dễ chịu, nắng hay mưa.');
  if (usableWindow && !testing) {
    const minutes = (Date.parse(usableWindow.to) - Date.parse(usableWindow.from)) / 60000;
    if (wet) {
      lines.push(`Trong ${rainNumber(minutes)} phút gần nhất ghi ${rainNumber(usableWindow.rainfallMm)} mm${usableWindow.coverageComplete && !usableWindow.uncertainTimingEvents ? `, trung bình ${rainNumber(usableWindow.rainfallMm * 60 / minutes)} mm/h` : ' trong phần dữ liệu đã lưu'}.`);
      if (!usableWindow.uncertainTimingEvents && usableWindow.coverageComplete && usableWindow.rainfallMm * 60 / minutes >= 10) lines.push(rainRateAssessment(usableWindow.rainfallMm * 60 / minutes, minutes));
      else if (usableWindow.uncertainTimingEvents) lines.push('Có lô nhịp chưa rõ giờ từng nhịp nên chưa suy mức mưa tức thời từ tổng này.');
    } else if (!pleasant && zero) lines.push(`Trong ${rainNumber(minutes)} phút gần nhất chưa ghi nhận nhịp mới; điều này chưa xác nhận đã tạnh hoàn toàn.`);
  }
  if (c.todayRainMm !== null) lines.push(`Phần đã lưu hôm nay: ${rainNumber(c.todayRainMm)} mm${c.rainHistory?.coverageComplete === false ? ', còn khoảng thiếu bản tin' : ''}.`);
  if ((c.testTodayMm ?? 0) > 0 || testing) lines.push(testing ? 'Các nhịp bạn mô tả là thử nước, không dùng để nhận xét mưa thực tế.' : `Đã tách riêng ${rainNumber(c.testTodayMm!)} mm nước thử.`);
  if (pleasant || /dep troi/.test(normalizeTimePhrase(query))) lines.push('Trạm chưa đo mây, nắng và gió; nhận xét này không bảo đảm cả ngày trời quang hoặc không mưa.');
  if (!fresh) lines.push('Số đo đã cũ/ngoại tuyến hoặc mốc đo bất hợp lý, chưa xác nhận được thời tiết hiện tại.');
  const at = c.observedAt ? new Date(c.observedAt).toLocaleString('vi-VN', { timeZone: c.timezone, hour12: false }) : 'chưa rõ thời điểm';
  lines.push(`Trạm ${c.deviceId}, bản đo lúc ${at}.`);
  return lines.join(' ');
}
