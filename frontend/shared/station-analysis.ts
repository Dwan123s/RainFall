import type { StationContext } from './rainsense-ai';
import { foldText } from './project-knowledge';
import { hasFutureTime } from './time-request';
import { calculateDewPoint } from './utils/weather-calc';

export function isStationAnalysisQuery(query: string): boolean {
  const q = foldText(query);
  if (/la gi|cach|nguyen ly|tai sao|vi sao|hieu chuan/.test(q) || hasFutureTime(q)) return false;
  return /phan tich|nhan dinh|danh gia|du doan|du bao.*(?:thong so|cam bien)|(?:thong so|cam bien).*du bao/.test(q) && /thoi tiet|moi truong|mua|nhiet do|do am|khi ap|ap suat|cam bien|thong so/.test(q);
}

/** Qualitative interpretation, not a calibrated probability model. No invented lead time or rain label. */
export function stationAnalysis(c: StationContext, now = new Date()): string {
  const f = c.weatherFeatures;
  const evidence: string[] = [];
  const t = f?.temperatureDelta1hC;
  const p = f?.pressureDelta3hHpa;
  const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;
  if (t != null) evidence.push(`nhiệt độ đổi ${signed(t)} °C trong 1 giờ`);
  if (p != null) evidence.push(`khí áp đổi ${signed(p)} hPa trong 3 giờ`);
  const completeHours = c.rainHistory?.hourly?.filter((w) => w.coverageComplete && Date.parse(w.to) - Date.parse(w.from) === 3600000).slice(-2) ?? [];
  if (completeHours.length === 2 && completeHours[0].to === completeHours[1].from) evidence.push(`nước qua gầu trong hai giờ đủ bản tin là ${completeHours[0].rainfallMm} rồi ${completeHours[1].rainfallMm} mm, đã loại thử được đánh dấu`);
  const lines = [evidence.length ? `Chuỗi quan trắc cho thấy ${evidence.join('; ')}.` : 'Chưa có chuỗi đủ liên tục để xác nhận mức thay đổi; các số hiện có vẫn mô tả được phần đã đo.'];
  const fresh = c.isOnline && c.observedAt !== null && now.getTime() - Date.parse(c.observedAt) >= -60000 && now.getTime() - Date.parse(c.observedAt) <= 300000;
  if (!fresh) lines.push('Quan trắc đang cũ hoặc trạm ngoại tuyến, nên chưa dùng để nhận định điều kiện sắp tới tại trạm.');
  else if (c.currentHumid !== null && c.currentHumid >= 90 && t != null && t < 0) lines.push('RH cao cùng nhiệt độ đang giảm gợi ý không khí tiến gần bão hòa; nếu tiếp tục lạnh đi có thể thuận lợi cho ngưng tụ, nhưng chưa đủ để kết luận sẽ mưa.');
  else if (c.currentTemp !== null && c.dewPoint !== null) lines.push(`Nhiệt độ cách điểm sương khoảng ${Number((c.currentTemp - c.dewPoint).toFixed(1))} °C; cần đọc cùng diễn biến RH, khí áp và nguồn khí tượng khu vực.`);
  else lines.push('Cần phối hợp các đại lượng còn hợp lệ; một giá trị khí áp hay RH riêng lẻ chưa xác định được mưa.');
  if ((c.testTodayMm ?? 0) > 0) lines.push(`Có ${c.testTodayMm} mm nước thử được tách riêng, không dùng để nhận định thời tiết.`);
  lines.push('Đây là nhận định định tính từ cảm biến; dự báo giờ mưa hoặc xác suất cần nguồn dự báo có vị trí, không tự suy phần trăm từ vài thông số.');
  return lines.join(' ');
}

export function stationAnalysisReply(c: StationContext, now = new Date()): string {
  if (c.currentTemp === null && c.currentHumid === null && c.currentPress === null && !c.weatherFeatures?.availableSampleCount && !c.weatherFeatures?.sampleCount) return 'Trạm chưa có báo cáo quan trắc môi trường hợp lệ để phân tích. Cần bản tin cảm biến mới; nếu bạn cung cấp số liệu và thời điểm, mình có thể phân tích như tình huống do bạn nêu.';
  const at = c.observedAt ? new Date(c.observedAt).toLocaleString('vi-VN', { timeZone: c.timezone, hour12: false }) : 'chưa xác định thời điểm';
  const values = [c.currentTemp === null ? '' : `nhiệt độ ${c.currentTemp.toFixed(1)} °C`, c.currentHumid === null ? '' : `độ ẩm ${c.currentHumid.toFixed(1)} %`, c.currentPress === null ? '' : `khí áp ${c.currentPress.toFixed(1)} hPa`].filter(Boolean);
  const rain = c.currentRainRateMmH === null ? '' : ` Gầu ghi nhận${c.todayRainMm === null ? '' : ` ${c.todayRainMm} mm trong phần lịch sử hôm nay đã lưu,`} cường độ quy đổi 5 phút ${c.currentRainRateMmH} mm/h; chưa xác minh là mưa tự nhiên.`;
  return `Theo báo cáo từ trạm ${c.stationName} (${c.deviceId}), cập nhật lúc ${at}, ${values.join(', ')}.${rain}\n\n${stationAnalysis(c, now)}`;
}

export function getSensorScenarioReply(query: string): string | null {
  const q = foldText(query);
  if (!/phan tich|nhan dinh|du bao|du doan|mua khong|sap mua|co mua|co chac/.test(q)) return null;
  const n = '(-?\\d+(?:[.,]\\d+)?)';
  const temps = Array.from(q.matchAll(new RegExp(`${n}\\s*(?:°\\s*c|do\\s*c)`, 'g')));
  const humidity = Array.from(q.matchAll(new RegExp(`${n}\\s*%`, 'g')));
  const pressure = Array.from(q.matchAll(new RegExp(`${n}\\s*(hpa|pa)\\b`, 'g')));
  if ([temps, humidity, pressure].filter((list) => list.length).length < 2) return null;
  if ([temps, humidity, pressure].some((list) => list.length > 1)) return 'Bạn đang đưa nhiều mốc số liệu. Hãy gắn thời điểm cho từng bộ nhiệt độ/RH/khí áp để so sánh xu hướng; mình chưa coi các số này là bản ghi tại trạm.';
  const parse = (s: string) => Number(s.replace(',', '.'));
  const t = temps[0] ? parse(temps[0][1]) : null;
  const h = humidity[0] ? parse(humidity[0][1]) : null;
  const p = pressure[0] ? parse(pressure[0][1]) / (pressure[0][2] === 'pa' ? 100 : 1) : null;
  if (t !== null && (t < -40 || t > 85) || h !== null && (h < 0 || h > 100) || p !== null && (p < 300 || p > 1100)) return 'Bộ số bạn cung cấp có giá trị ngoài khoảng kiểm tra của RainSense. Hãy kiểm tra °C, %RH, hPa/Pa và giá trị cảm biến trước khi phân tích; mình chưa thay chúng vào số đo của trạm.';
  const values = [t === null ? '' : `${t} °C`, h === null ? '' : `RH ${h}%`, p === null ? '' : `${p} hPa`].filter(Boolean);
  let text = `Theo bộ số bạn cung cấp (${values.join(', ')}), chưa đối chiếu với trạm: `;
  if (t !== null && h !== null && h > 0) text += `điểm sương tính được khoảng ${calculateDewPoint(t, h)} °C. `;
  text += 'Một bộ số đo chỉ cho biết trạng thái tại một thời điểm, chưa xác định xu hướng hoặc chắc chắn có mưa. RH cao có thể do không khí lạnh đi; để nhận định sắp tới cần chuỗi đo liên tục và dự báo/radar theo vị trí. Không có căn cứ để gán giờ mưa hay phần trăm xác suất từ các số này.';
  return text;
}
