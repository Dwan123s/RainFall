import type { StationContext } from './rainsense-ai';
import { observationMetrics } from './observation-request';
import { hasFutureTime, normalizeTimePhrase, parseTimeDuration } from './time-request';
import { describeRainWindow, nearestRainWindow, isWaterTestQuery } from './rain-interpretation';

/** Read a measured snapshot without a model selecting just one of several requested sensors. */
export function getCurrentObservationReply(query: string, c: StationContext, now = new Date()): string | null {
  const q = normalizeTimePhrase(query);
  if (hasFutureTime(q) || /du bao|nguyen ly|la gi|cach|hoat dong|bme280|a3144|hall|cam bien|hieu chuan|cong thuc|tai sao|xu huong|trung binh|cao nhat|thap nhat|thay doi|ngung|tanh|ngap|lu lut|sat lo|dong set|co bao|bao khong|thien tai|keo dai|nguy co/.test(q)) return null;
  if (/hom qua|tuan|thang|\btu\s+\d|\bluc\s*\d/.test(q) || parseTimeDuration(q).status !== 'none') return null;
  const metrics = observationMetrics(q);
  if (!metrics.length) return null;
  const plainMetrics = q.replace(/nhiet do|do am|khi ap|ap suat|luong mua|thoi tiet|moi truong|thong so/g, '').replace(/\b(?:va|voi|cho biet|xem|bao cao)\b/g, '').replace(/[\s,.?!:;]+/g, '') === '';
  if (!plainMetrics && !/\bhien tai\b|\bluc nay\b|\bbay gio\b|tong quan|thong so.*moi nhat|bao nhieu|dang.*mua/.test(q)) return null;
  if (c.currentTemp === null && c.currentHumid === null && c.currentPress === null && c.todayRainMm === null) return `Trạm ${c.stationName} (${c.deviceId}) chưa có báo cáo quan trắc để phân tích. Chưa thể xác nhận có mưa hay không; cần chờ bản tin đo mới.`;
  const time = (at: string | null) => at ? new Date(at).toLocaleString('vi-VN', { timeZone: c.timezone, hour12: false }) : 'chưa xác định thời điểm';
  const value = (number: number | null | undefined, unit: string, digits = 1) => number == null ? 'chưa có dữ liệu' : `${number.toFixed(digits)} ${unit}`;
  const age = c.observedAt ? now.getTime() - Date.parse(c.observedAt) : NaN;
  const fresh = c.isOnline && Number.isFinite(age) && age >= -60000 && age <= 300000;
  const lines: string[] = [];
  for (const metric of metrics) {
    if (metric === 'temperature') lines.push(`Nhiệt độ: ${value(c.currentTemp, '°C')}.`);
    if (metric === 'humidity') lines.push(`Độ ẩm: ${value(c.currentHumid, '%')}.`);
    if (metric === 'pressure') lines.push(`Áp suất: ${value(c.currentPress, 'hPa')}.`);
    if (metric === 'rain') {
      lines.push(`Lượng ghi nhận hôm nay: ${value(c.todayRainMm, 'mm', 2)}${c.totalTipsToday === null ? '' : ` (${c.totalTipsToday} nhịp)`}.`);
      const window = nearestRainWindow(c);
      if (window) lines.push(describeRainWindow(window, { testing: isWaterTestQuery(query), demo: c.dataQuality?.demo, timezone: c.timezone }));
      else lines.push(c.currentRainRateMmH === 0 ? 'Chưa ghi nhận nhịp lật mới trong cửa sổ 5 phút; chưa thể khẳng định đã tạnh hoàn toàn.' : `Cường độ quy đổi 5 phút: ${value(c.currentRainRateMmH, 'mm/h')}; chưa có mốc từng nhịp để đối chiếu cường độ này.`);
      if ((c.testTodayMm ?? 0) > 0 && !window?.testRainfallMm) lines.push(`Nước thử hôm nay tách riêng: ${value(c.testTodayMm, 'mm', 2)}.`);
    }
  }
  if (!fresh) lines.push('Đây là bản ghi gần nhất; dữ liệu đã cũ, ở tương lai bất hợp lý hoặc trạm ngoại tuyến; chưa xác nhận được thời tiết hiện tại.');
  lines.push(`Trạm ${c.deviceId}, bản đo lúc ${time(c.observedAt)} (${c.timezone}).`);
  return lines.join('\n\n');
}
