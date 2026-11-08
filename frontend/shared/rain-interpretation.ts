import type { RainWindow, StationContext } from './rainsense-ai';
import { getRainRateCategoryVi } from './utils/weather-calc';
import { foldText } from './project-knowledge';
import { normalizeTimePhrase, parseTimeDuration } from './time-request';

export const rainNumber = (n: number) => Number(n.toFixed(2)).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
export const isWaterTestQuery = (query: string) => {
  const q = foldText(query);
  if (/khong (?:phai|con).*thu|da loai|loai tru|khong tinh.*thu|tach.*thu nuoc/.test(q)) return false;
  return /thu nuoc|xa nuoc|do nuoc|\btest\b|thu nghiem/.test(q);
};

/** Project interpretation only: these bands are not legal warnings or calibrated flood probabilities. */
export function rainRateAssessment(rate: number, minutes: number): string {
  if (!Number.isFinite(rate) || rate <= 0 || minutes <= 0) return '';
  const band = getRainRateCategoryVi(rate);
  const category = band.level === 'NONE' ? 'lượng ghi nhận rất nhỏ' : band.labelVi.toLowerCase();
  let text = `Mức ${category} theo quy ước cường độ của dashboard.`;
  if (rate >= 50 && minutes >= 30) text += ' Nguy cơ ngập cục bộ có thể cao tại nơi trũng hoặc thoát nước kém; nếu mưa tiếp tục, nước tích lũy có thể tăng nhanh.';
  else if (rate >= 50) text += ' Nếu cường độ này duy trì, nguy cơ ngập cục bộ có thể tăng cao tại nơi trũng hoặc thoát nước kém; một cửa sổ ngắn chưa chứng minh mưa lớn kéo dài cả giờ.';
  else if (rate >= 10) text += ' Cần chú ý nguy cơ quá tải thoát nước ở nơi thoát kém nếu mưa tiếp tục.';
  else text += ' Mức này chưa gợi ý nguy cơ ngập cao chỉ từ lượng vừa đo; vẫn cần xem mưa tích lũy và điều kiện tại chỗ.';
  if (rate >= 10) text += ' Theo dõi mực nước và cảnh báo địa phương, tránh đường ngập.';
  return text;
}

export function describeRainWindow(w: RainWindow, options: { testing?: boolean; demo?: boolean; timezone?: string } = {}): string {
  const { testing = false, demo = false } = options;
  const lines: string[] = [];
  const minutes = (Date.parse(w.to) - Date.parse(w.from)) / 60000;
  // A daily total is not evidence of an instantaneous rate, even when all day is covered.
  const isDay = /hôm nay|hôm qua|ngày|buổi|sáng|chiều|tối|đêm/i.test(w.label);
  let rate: number | null = null;
  let rateMinutes = minutes;
  if (!w.uncertainTimingEvents && w.coverageComplete && minutes > 0 && minutes <= 180 && !isDay) {
    rate = w.rainfallMm * 60 / minutes;
    if (w.rainfallMm > 0) lines.push(`Trung bình ${rainNumber(rate)} mm/h trong ${rainNumber(minutes)} phút được hỏi, không phải cường độ tức thời.`);
  } else if (!w.coverageComplete && !isDay) {
    const span = w.observedSegments?.filter((s) => !s.uncertainTimingEvents && Date.parse(s.to) - Date.parse(s.from) >= 60000)
      .sort((a, b) => b.rainfallMm - a.rainfallMm || b.to.localeCompare(a.to))[0];
    if (span && span.rainfallMm > 0) {
      rateMinutes = (Date.parse(span.to) - Date.parse(span.from)) / 60000;
      rate = span.rainfallMm * 60 / rateMinutes;
      const time = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: options.timezone ?? 'Asia/Ho_Chi_Minh', hour12: false });
      lines.push(`Riêng đoạn liên tục ${rainNumber(rateMinutes)} phút (${time(span.from)}–${time(span.to)}) ghi ${rainNumber(span.rainfallMm)} mm, trung bình ${rainNumber(rate)} mm/h cho đoạn đó.`);
    }
  }
  if (rate === null && !w.coverageComplete && !w.uncertainTimingEvents && !isDay && minutes > 0 && minutes <= 180 && w.rainfallMm > 0) {
    rate = w.rainfallMm * 60 / minutes;
    lines.push(`Quy đổi riêng phần đã ghi trong ${rainNumber(minutes)} phút: tối thiểu ${rainNumber(rate)} mm/h trên cửa sổ yêu cầu; không giả định mưa liên tục hoặc biết lượng ở đoạn mất bản tin.`);
  }
  if (testing || demo) lines.push(testing ? 'Theo bạn mô tả đây là thử nước; chỉ dùng để kiểm tra gầu, không nhận định nguy cơ thời tiết từ các nhịp này.' : 'Đây là dữ liệu giả lập, không dùng để nhận định thời tiết thực tế.');
  else if (rate !== null && rate > 0) lines.push(rainRateAssessment(rate, rateMinutes));
  else if (w.rainfallMm > 0) {
    lines.push(w.rainfallMm >= 30 ? 'Lượng tích lũy đã ghi nhận đáng chú ý; tổng này chưa cho biết hiện giờ mưa to hay nhỏ.' : 'Đây là lượng tích lũy đã ghi nhận; cần đọc cùng cửa sổ gần nhất để đánh giá mưa hiện tại.');
  } else lines.push('Chưa ghi nhận nhịp ngoài thử nước trong khoảng này; chưa thể khẳng định không mưa hoặc đã tạnh hoàn toàn.');
  if ((w.testRainfallMm ?? 0) > 0) lines.push(`Nước thử tách riêng: ${rainNumber(w.testRainfallMm!)} mm (${w.testTips ?? 0} nhịp), không dùng làm bằng chứng thời tiết.`);
  if (w.uncertainTimingEvents) lines.push('Có lô nhịp chưa biết giờ chính xác từng nhịp; chưa dùng tổng lô để suy cường độ ngắn hạn.');
  if (!w.coverageComplete) lines.push('Bản tin chưa phủ đủ khoảng yêu cầu; tổng trên chỉ là phần đã lưu, không coi đoạn thiếu là không mưa.');
  return lines.join(' ');
}

/** Prefer the nearest known window; never turn today's total or a backfilled batch into a current storm. */
export function nearestRainWindow(c: StationContext): RainWindow | undefined {
  const short = c.rainWindows?.find((w) => w.label === '5 phút trượt');
  const hour = c.rainWindows?.find((w) => w.label === '1 giờ trượt');
  if (short && short.rainfallMm > 0 && !short.uncertainTimingEvents) return short;
  if (hour && hour.rainfallMm > 0) return hour;
  return short ?? hour;
}

/** User-supplied rain is a separate source, including when no model/key/location exists. */
export function getRainScenarioReply(query: string): string | null {
  const q = normalizeTimePhrase(query);
  if (/(?:neu|giu nguyen|duy tri).*mm\s*\/\s*(?:h|gio)\b/.test(q)) return null;
  if (!/mua|ngap|lu lut|nguy co/.test(q) || /bao cao|truy xuat|toi nho|tram.*ghi|so (?:lan|nhip)|g[aa]u.*lat|hieu chuan|cong thuc/.test(q)) return null;
  const matches = Array.from(q.matchAll(/(-?\d+(?:[.,]\d+)?)\s*mm(?!\s*\/\s*(?:tip|lan|nhip))/g));
  if (!matches.length) return null;
  if (matches.length !== 1) return 'Bạn đưa nhiều mức mưa; hãy gắn từng mức với khoảng thời gian để mình phân tích riêng, không cộng nhầm các khoảng.';
  const mm = Number(matches[0][1].replace(',', '.'));
  if (!Number.isFinite(mm) || mm < 0) return 'Lượng mưa bạn đưa cần là số không âm, với đơn vị mm hoặc mm/h.';
  const isRate = new RegExp(`${matches[0][0]}\\s*/\\s*(?:h\\b|gio\\b)`).test(q);
  const durationText = q.replace(/-?\d+(?:[.,]\d+)?\s*mm\s*\/\s*(?:h|gio)\b/g, '');
  const duration = parseTimeDuration(durationText);
  if (duration.status === 'invalid') return 'Mình đã nhận mức mưa bạn cung cấp; hãy nêu một thời lượng rõ ràng để không quy đổi nhầm mm và mm/h.';
  const minutes = duration.status === 'ready' ? duration.milliseconds / 60000 : null;
  const rate = isRate ? mm : minutes ? mm * 60 / minutes : null;
  let text = `Theo số liệu bạn cung cấp, ${isRate ? `cường độ ${rainNumber(mm)} mm/h` : `lượng ${rainNumber(mm)} mm${minutes ? ` trong ${rainNumber(minutes)} phút, trung bình ${rainNumber(rate!)} mm/h` : ''}`}; chưa đối chiếu với trạm. `;
  if (isWaterTestQuery(query)) return text + 'Đây là thử nước, không dùng các nhịp này để nhận định ngập/lũ hay thời tiết thực tế.';
  if (rate !== null) text += mm > 0 ? rainRateAssessment(rate, minutes ?? 5) : 'Chưa có lượng mưa trong số liệu bạn đưa; riêng điều này không xác nhận hết nguy cơ ngập từ mưa trước đó.';
  else text += 'Đây là lượng tích lũy; cần thời lượng để biết mưa tập trung mạnh hay rải trong ngày. Nếu dồn trong thời gian ngắn, nguy cơ ngập nơi trũng hoặc thoát kém sẽ đáng chú ý hơn.';
  if (/lu quet|sat lo/.test(q) && mm > 0) text += ' Ở khu vực dốc, gần suối hoặc đất đã ướt, mưa lớn tiếp diễn có thể tăng nguy cơ lũ quét/sạt lở.';
  return text + ' Đây là nhận định sơ bộ theo tình huống, không xác nhận đang xảy ra lũ.';
}
