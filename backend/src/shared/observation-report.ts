import type { WeatherFeatures } from './ai-types';
import type { RainWindow, StationContext } from './rainsense-ai';
import { foldText } from './project-knowledge';
import { getStartOfDayInTimezone } from './utils/time';

export type ObservationMetric = 'temperature' | 'humidity' | 'pressure' | 'rain';
export interface ObservationRequest { from: string; to: string; label: string; metrics: ObservationMetric[]; includeEnd?: boolean }
export interface ObservationReport extends ObservationRequest {
  generatedAt: string;
  weather: WeatherFeatures;
  rain: RainWindow;
  historyTruncated: boolean;
}
export type ParsedObservation = { status: 'none' } | { status: 'invalid'; message: string } | { status: 'ready'; request: ObservationRequest };

export function parseObservationRequest(query: string, timezone: string, now = new Date()): ParsedObservation {
  const q = foldText(query).replace(/\bmot\s+(gio|tieng|phut|ngay)\b/g, '1 $1');
  if (/du bao|ngay mai|chieu mai|sang mai|toi mai|ngay kia|(?:gio|tieng|phut) toi|nguyen ly|la gi|cong thuc|hieu chuan/.test(q)) return { status: 'none' };
  const metrics: ObservationMetric[] = [];
  if (/nhiet do/.test(q)) metrics.push('temperature');
  if (/do am/.test(q)) metrics.push('humidity');
  if (/khi ap|ap suat/.test(q)) metrics.push('pressure');
  if (/\bmua\b|gau.*lat|so nhip/.test(q)) metrics.push('rain');
  if (!metrics.length && /thoi tiet|moi truong|bao cao|thong so/.test(q)) metrics.push('temperature', 'humidity', 'pressure', 'rain');
  if (!metrics.length) return { status: 'none' };

  const dayStart = getStartOfDayInTimezone(now, timezone).getTime() - (/hom qua/.test(q) ? 86400000 : 0);
  const clock = q.match(/tu\s+(\d{1,2})(?::(\d{2}))?\s*(?:gio|h)?\s*(?:den|toi|-)\s*(\d{1,2})(?::(\d{2}))?\s*(?:gio|h)?/);
  let from: number;
  let to = now.getTime();
  let label: string;
  if (clock) {
    const a = Number(clock[1]) * 60 + Number(clock[2] ?? 0);
    const b = Number(clock[3]) * 60 + Number(clock[4] ?? 0);
    if (Number(clock[1]) > 23 || Number(clock[3]) > 24 || Number(clock[2] ?? 0) > 59 || Number(clock[4] ?? 0) > 59 || b > 1440 || b <= a) {
      return { status: 'invalid', message: 'Cần khoảng giờ hợp lệ trong cùng ngày, giờ kết thúc sau giờ bắt đầu; ví dụ “từ 13:00 đến 14:00 hôm nay”.' };
    }
    from = dayStart + a * 60000;
    to = dayStart + b * 60000;
    if (to > now.getTime()) return { status: 'invalid', message: 'Khoảng quan trắc được hỏi chưa kết thúc hoặc còn ở tương lai. Bạn có thể hỏi “1 tiếng vừa qua” để báo cáo phần đã ghi nhận.' };
    label = /hom qua/.test(q) ? 'khoảng giờ hôm qua' : 'khoảng giờ hôm nay';
  } else {
    if (/\bluc\s*\d|\bgio\s*\d|\d{1,2}[/]\d{1,2}|ngay\s*\d/.test(q)) return { status: 'invalid', message: 'Cần chỉ rõ khoảng quan trắc, ví dụ “1 tiếng vừa qua” hoặc “từ 13:00 đến 14:00 hôm nay”; mình không thay mốc giờ cụ thể bằng tổng ngày.' };
    const duration = q.match(/(-?\d+(?:[.,]\d+)?)\s*(tieng|gio|phut|ngay|h)\b/);
    if (duration) {
      if (/hom qua/.test(q)) return { status: 'invalid', message: 'Bạn muốn giờ nào của hôm qua? Hãy nêu giờ bắt đầu và kết thúc để truy xuất đúng khoảng.' };
      const count = Number(duration[1].replace(',', '.'));
      const unit = duration[2];
      const milliseconds = count * (unit === 'phut' ? 60000 : unit === 'ngay' ? 86400000 : 3600000);
      if (!Number.isFinite(milliseconds) || milliseconds < 60000 || milliseconds > 7 * 86400000) return { status: 'invalid', message: 'Khoảng báo cáo phải từ 1 phút đến tối đa 7 ngày.' };
      from = to - milliseconds;
      label = `${count} ${unit === 'tieng' || unit === 'h' ? 'giờ' : unit === 'gio' ? 'giờ' : unit === 'phut' ? 'phút' : 'ngày'} vừa qua`;
    } else if (/hom qua|hom nay/.test(q)) {
      from = dayStart;
      to = /hom qua/.test(q) ? dayStart + 86400000 : now.getTime();
      label = /hom qua/.test(q) ? 'hôm qua' : 'hôm nay tính đến thời điểm chốt';
    } else if (/trong|vong|gio qua|tieng qua|gio vua qua|tieng vua qua|gio gan nhat/.test(q)) {
      if (/gio qua|tieng qua|gio vua qua|tieng vua qua|gio gan nhat/.test(q)) {
        from = to - 3600000; label = '1 giờ vừa qua';
      } else return { status: 'none' };
    } else if (/cao nhat|thap nhat|trung binh|xu huong|thay doi/.test(q)) {
      from = to - 86400000; label = '24 giờ vừa qua (khoảng mặc định khi chưa nêu thời lượng)';
    } else return { status: 'none' };
  }
  if (to <= from) return { status: 'invalid', message: 'Khoảng quan trắc chưa có thời lượng. Bạn có thể hỏi “1 tiếng vừa qua”.' };
  return { status: 'ready', request: { from: new Date(from).toISOString(), to: new Date(to).toISOString(), label, metrics, includeEnd: !clock && !/hom qua/.test(q) } };
}

const display = (value: number) => Number(value.toFixed(2)).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export function formatObservationReport(report: ObservationReport, context: StationContext, query: string): string {
  const time = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: context.timezone, hour12: false });
  const lines = [`Báo cáo ${report.label} của trạm ${context.stationName} (${context.deviceId}), từ ${time(report.from)} đến ${time(report.to)} (${context.timezone}):`];
  const labels = { temperature: ['Nhiệt độ', '°C'], humidity: ['Độ ẩm', '%'], pressure: ['Áp suất', 'hPa'] } as const;
  const trend = /xu huong|thay doi|tang|giam/.test(foldText(query));
  for (const metric of report.metrics) {
    if (metric === 'rain') {
      const r = report.rain;
      lines.push(`Lượng nước qua gầu quy đổi, đã loại dữ liệu thử được đánh dấu: ${display(r.rainfallMm)} mm, ${r.tips} nhịp theo mốc ghi nhận trong khoảng được hỏi.${r.coverageComplete ? '' : ' Bản tin chưa phủ đủ khoảng, nên đây chỉ là phần đã ghi nhận; không xác nhận toàn khoảng không mưa nếu chưa có nhịp.'}`);
      lines.push(`Nước thử tách riêng: ${display(r.testRainfallMm ?? 0)} mm, ${r.testTips ?? 0} nhịp; không đưa vào tổng trên và không dùng làm bằng chứng thời tiết.`);
      if (r.uncertainTimingEvents) lines.push('Có sự kiện gộp theo bản tin hoặc dữ liệu cũ: mốc lưu không chứng minh giờ chính xác của từng nhịp; tổng sát ranh giới giờ/ngày có thể chưa xác định chính xác.');
      continue;
    }
    const s = report.weather[metric];
    const [label, unit] = labels[metric];
    if (!s) { lines.push(`${label}: chưa có số đo hợp lệ trong khoảng này.`); continue; }
    let text = `${label}: trung bình các bản đo ${display(s.avg)} ${unit}, thấp nhất ${display(s.min)} ${unit}, cao nhất ${display(s.max)} ${unit}`;
    if (s.lastValue !== undefined) text += `; bản đo cuối ${display(s.lastValue)} ${unit}`;
    text += '.';
    if (s.firstObservedAt && s.lastObservedAt) text += ` Có ${s.sampleCount} bản đo từ ${time(s.firstObservedAt)} đến ${time(s.lastObservedAt)}.`;
    if (trend && s.firstValue !== undefined && s.lastValue !== undefined) {
      const delta = s.lastValue - s.firstValue;
      text += (s.sampleCount ?? 0) >= 2 ? ` Chênh lệch đầu–cuối phần đã đo: ${delta > 0 ? '+' : ''}${display(delta)} ${unit}; không suy ra diễn biến ở khoảng thiếu.` : ' Một bản đo chưa đủ để xác định mức thay đổi.';
    }
    lines.push(text);
  }
  if (report.metrics.some((m) => m !== 'rain' && !report.weather[m]?.coverageComplete)) lines.push('Chuỗi số đo chưa phủ liên tục toàn khoảng yêu cầu; vẫn báo cáo phần đã có ở trên, chưa đại diện cho toàn khoảng.');
  if (report.historyTruncated) lines.push('Truy vấn chạm giới hạn bản ghi; báo cáo có thể thiếu lịch sử.');
  if (report.metrics.includes('rain')) lines.push(/thu nuoc|xa nuoc|do nuoc|\btest\b|thu nghiem/.test(foldText(query)) ? 'Theo bạn mô tả đây là thử nước; các số mm không phải xác nhận mưa tự nhiên.' : 'Gầu không phân biệt nước thử và mưa tự nhiên; các số trên mô tả dữ liệu đã ghi nhận.');
  return lines.join('\n\n');
}
