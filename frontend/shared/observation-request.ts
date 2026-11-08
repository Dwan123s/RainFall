import type { ObservationMetric, ParsedObservation } from './observation-report';
import { normalizeTimePhrase, hasFutureTime, parseTimeDuration } from './time-request';
import { getStartOfDayInTimezone } from './utils/time';

export function observationMetrics(q: string): ObservationMetric[] {
  const metrics: ObservationMetric[] = [];
  if (/nhiet do/.test(q)) metrics.push('temperature');
  if (/do am/.test(q)) metrics.push('humidity');
  if (/khi ap|ap suat/.test(q)) metrics.push('pressure');
  if (/\bmua\b|g[aa]u.*lat|so (?:nhip|lan)/.test(q)) metrics.push('rain');
  if (!metrics.length && /thoi tiet|moi truong|bao cao|thong so|tong quan/.test(q)) metrics.push('temperature', 'humidity', 'pressure', 'rain');
  return metrics;
}

export function parseObservationRequest(query: string, timezone: string, now = new Date()): ParsedObservation {
  const q = normalizeTimePhrase(query);
  if (/du bao|nguyen ly|la gi|cong thuc|hieu chuan|hoat dong|tai sao/.test(q) || hasFutureTime(q)) return { status: 'none' };
  const metrics = observationMetrics(q);
  if (!metrics.length) return { status: 'none' };
  const invalid = (message = 'Khoảng thời gian chưa rõ hoặc chưa được hỗ trợ. Hãy chọn một khoảng từ 1 phút đến 7 ngày, ví dụ “1 giờ 30 phút vừa qua” hoặc “từ 13:00 đến 14:00 hôm qua”.'): ParsedObservation => ({ status: 'invalid', message });
  // Reject unsupported anchors before matching a valid-looking clock substring.
  if (/\btuan\b|\bthang\b|\bnam nay\b|hom kia|\bngay\s+\d|\d{1,4}[/-]\d{1,2}|thu (?:hai|ba|tu|nam|sau|bay)|chu nhat|\d+\s*(?:giay|s)\b|(?:vai|may)\s*(?:gio|tieng|phut)/.test(q)) return invalid();
  if (/hom qua/.test(q) && /hom nay/.test(q)) return invalid();
  const dayStart = getStartOfDayInTimezone(now, timezone).getTime() - (/hom qua/.test(q) ? 86400000 : 0);
  const clocks = Array.from(q.matchAll(/\btu\s*(\d{1,2})(?:(?::|\s*(?:h|gio)\s*)(\d{2})|\s*(?:h|gio)\b)?\s*(?:den|toi|-)\s*(\d{1,2})(?:(?::|\s*(?:h|gio)\s*)(\d{2})|\s*(?:h|gio)\b)?(?!\d|:|[.,]\d|h|\s*gio\b)/g));
  if (clocks.length > 1) return invalid('Hãy hỏi một khoảng giờ mỗi lần để mình truy xuất đúng dữ liệu, không gộp nhiều khoảng thành tổng ngày.');
  const clock = clocks[0];
  let from: number;
  let to = now.getTime();
  let label: string;
  let includeEnd = true;
  if (clock) {
    if (/\btu\b|\bden\b/.test(q.slice(clock.index! + clock[0].length))) return invalid();
    const a = Number(clock[1]) * 60 + Number(clock[2] ?? 0);
    const b = Number(clock[3]) * 60 + Number(clock[4] ?? 0);
    if (Number(clock[1]) > 23 || Number(clock[3]) > 24 || Number(clock[2] ?? 0) > 59 || Number(clock[4] ?? 0) > 59 || b > 1440 || b <= a) return invalid('Cần khoảng giờ hợp lệ trong cùng ngày, giờ kết thúc sau giờ bắt đầu; ví dụ “từ 13:00 đến 14:00 hôm nay”.');
    from = dayStart + a * 60000; to = dayStart + b * 60000;
    if (to > now.getTime()) return invalid('Khoảng quan trắc được hỏi chưa kết thúc hoặc còn ở tương lai. Bạn có thể hỏi “1 tiếng vừa qua” để báo cáo phần đã ghi nhận.');
    label = /hom qua/.test(q) ? 'khoảng giờ hôm qua' : 'khoảng giờ hôm nay';
    includeEnd = false;
  } else {
    if (/\btu\s*\d|\bluc\s*\d|\bgio\s+\d+\s*[?.!]*$|\d{1,2}:\d{2}|\d{1,2}h\d{2}/.test(q)) return invalid();
    const duration = parseTimeDuration(q);
    if (duration.status === 'invalid') return invalid();
    if (duration.status === 'ready') {
      if (/hom qua|\btruoc\b/.test(q)) return invalid('Bạn muốn mốc hoặc khoảng giờ nào? “2 giờ trước” là một mốc, còn “2 giờ vừa qua” là khoảng thống kê; hãy nêu rõ để mình không thay bằng tổng hiện tại.');
      if (duration.milliseconds < 60000 || duration.milliseconds > 7 * 86400000) return invalid('Khoảng báo cáo phải từ 1 phút đến tối đa 7 ngày.');
      from = to - duration.milliseconds;
      label = duration.milliseconds % 3600000 === 0 ? `${duration.milliseconds / 3600000} giờ vừa qua` : `${duration.milliseconds / 60000} phút vừa qua`;
    } else {
      const parts = Array.from(q.matchAll(/\bsang\b|\bchieu\b|\btoi nay\b|\bbuoi toi\b|\bdem\b/g));
      if (parts.length > 1) return invalid('Hãy chọn một buổi hoặc nêu giờ bắt đầu và kết thúc; mình chưa gộp nhiều buổi thành một báo cáo so sánh.');
      if (parts.length) {
        const part = parts[0][0];
        const [a, b, name] = part === 'sang' ? [6, 12, 'buổi sáng'] : part === 'chieu' ? [12, 18, 'buổi chiều'] : part === 'dem' ? [0, 6, 'ban đêm'] : [18, 24, 'buổi tối'];
        from = dayStart + Number(a) * 3600000;
        to = Math.min(now.getTime(), dayStart + Number(b) * 3600000);
        if (to <= from) return invalid('Buổi được hỏi chưa bắt đầu, nên chưa có quan trắc cho buổi đó.');
        label = `${name} ${/hom qua/.test(q) ? 'hôm qua' : 'hôm nay'}${to < dayStart + Number(b) * 3600000 ? ' tính đến thời điểm chốt' : ''}`;
        includeEnd = to === now.getTime();
      } else if (/hom qua|hom nay|trong ngay|ca ngay/.test(q)) {
        from = dayStart; to = /hom qua/.test(q) ? dayStart + 86400000 : now.getTime();
        label = /hom qua/.test(q) ? 'hôm qua' : 'hôm nay tính đến thời điểm chốt';
        includeEnd = !/hom qua/.test(q);
      } else if (/gio qua|tieng qua|gio vua qua|tieng vua qua|gio gan nhat|tieng gan nhat/.test(q)) {
        from = to - 3600000; label = '1 giờ vừa qua';
      } else if (/cao nhat|thap nhat|trung binh|xu huong|thay doi/.test(q)) {
        from = to - 86400000; label = '24 giờ vừa qua (khoảng mặc định khi chưa nêu thời lượng)';
      } else return { status: 'none' };
    }
  }
  if (to <= from) return invalid('Khoảng quan trắc chưa có thời lượng. Bạn có thể hỏi “1 tiếng vừa qua”.');
  return { status: 'ready', request: { from: new Date(from).toISOString(), to: new Date(to).toISOString(), label, metrics, includeEnd } };
}
