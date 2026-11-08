import type { RainWindow, StationContext } from './rainsense-ai';
import { stationAnalysisReply } from './station-analysis';

const numberText = (n: number) => Number(n.toPrecision(12)).toString();
const parse = (s: string) => Number(s.replace(',', '.'));
const numericPattern = '(-?\\d+(?:[.,]\\d+)?)';

function stationTime(iso: string, c: StationContext) {
  return new Date(iso).toLocaleString('vi-VN', { timeZone: c.timezone, hour12: false });
}

function describeCount(w: RainWindow, c: StationContext): string {
  const mixed = w.calibrationFactors.length > 1 ? ' Hệ số đã thay đổi trong khoảng này nên số nhịp được cộng trực tiếp từ sự kiện, không chia tổng mm cho hệ số hiện tại.' : '';
  return `Theo sự kiện đã lưu của trạm ${c.stationName} (${c.deviceId}), ${w.label}, từ ${stationTime(w.from, c)} đến ${stationTime(w.to, c)} (${c.timezone}), ghi nhận ${w.tips} lần gầu lật và ${numberText(w.rainfallMm)} mm.${mixed}${w.coverageComplete ? '' : ' Dữ liệu chưa phủ đủ khoảng; đây chỉ là phần đã ghi nhận, không xác nhận toàn bộ số nhịp đã xảy ra.'}`;
}

/** Deterministic arithmetic: used before calling a model as well as in offline replies. */
export function getBucketCalculationReply(query: string, c: StationContext): string | null {
  const q = query.toLowerCase().normalize('NFC');
  const countIntent = /(?:gầu|gàu).*lật|(?:số|bao nhiêu).*(?:nhịp|tips?)|quy đổi/.test(q);
  const projectedIntent = /(?:nếu|giữ|duy trì).*(?:mm\s*\/\s*(?:h|giờ))/.test(q);
  if (!countIntent && !projectedIntent) return null;
  // Explanations of the mechanism still go to the normal project knowledge branch.
  if (!/bao nhiêu|tính|quy đổi|tương đương|số lần|số nhịp|đổi.*(?:mm|lượng)|mm|hôm nay|giờ|ngày|buổi/.test(q)) return null;

  const factorMatch = q.match(new RegExp(`${numericPattern}\\s*mm\\s*[/]\\s*(?:tip|lần|nhịp)`))
    ?? q.match(new RegExp(`(?:hệ số(?:\\s+hiệu chuẩn)?|k)\\s*(?:là|=|:)?\\s*${numericPattern}`));
  const factor = factorMatch ? parse(factorMatch[1]) : c.calibrationFactor;
  const factorSource = factorMatch ? 'hệ số giả định bạn cung cấp' : 'hệ số cấu hình hiện tại';
  const rawMeasures = Array.from(q.matchAll(new RegExp(`${numericPattern}\\s*mm(?:\\s*[/]\\s*(h|giờ|tip|lần|nhịp))?`, 'g')));
  const measures = rawMeasures.filter((m) => !['tip', 'lần', 'nhịp'].includes(m[2]));
  const amount = measures[0];
  const suppliedTips = q.match(new RegExp(`${numericPattern}\\s*(?:lần(?:\\s+(?:gầu|gàu)\\s+lật)?|nhịp|tips?)`));
  const convertingToRain = /(?:bao nhiêu|tính|đổi|tương đương).*(?:mm|lượng mưa)/.test(q) && suppliedTips && !amount;

  if (measures.length > 1) return 'Bạn đang đưa nhiều mức mưa. Hãy chỉ rõ từng khoảng và hệ số tương ứng để tính riêng rồi cộng số nhịp; không dùng một hệ số cho các đoạn đã hiệu chuẩn khác nhau.';
  if (amount || convertingToRain) {
    if (countIntent && factor === null) return 'Cần hệ số hiệu chuẩn (mm/tip) để quy đổi. Bạn cung cấp hệ số của gầu; mình không mặc định 0.64 mm/tip.';
    if (countIntent && (factor === null || !Number.isFinite(factor) || factor <= 0)) return 'Hệ số hiệu chuẩn phải là số hữu hạn lớn hơn 0 mm/tip; chưa thể quy đổi với hệ số này.';
    if (convertingToRain && suppliedTips) {
      if (factor === null) return 'Cần hệ số hiệu chuẩn (mm/tip) để quy đổi.';
      const tips = parse(suppliedTips[1]);
      if (!Number.isSafeInteger(tips) || tips < 0) return 'Số lần gầu lật thực tế phải là số nguyên không âm. Bạn kiểm tra lại số nhịp cần quy đổi.';
      const mm = tips * factor;
      if (!Number.isFinite(mm)) return 'Giá trị quá lớn để quy đổi tin cậy; bạn kiểm tra lại số liệu.';
      return `Theo số nhịp bạn cung cấp và ${factorSource} ${numberText(factor)} mm/tip, P = ${tips} × ${numberText(factor)} = ${numberText(mm)} mm, giả sử hệ số không đổi trong khoảng đó. Đây là phép quy đổi, chưa xác minh với lịch sử trạm.`;
    }
    const measurement = parse(amount![1]);
    if (!Number.isFinite(measurement) || measurement < 0) return 'Lượng mưa hoặc cường độ phải là số hữu hạn không âm để quy đổi.';
    let mm = measurement;
    let assumption = '';
    if (amount![2] === 'h' || amount![2] === 'giờ') {
      // Do not mistake a clock time (e.g. lúc 15 giờ) for a duration.
      const duration = q.match(new RegExp(`(?:trong|kéo dài|duy trì(?:\\s+trong)?|giữ nguyên(?:\\s+trong)?|thêm|suốt)\\s+${numericPattern}\\s*(giờ|phút)`));
      if (!duration) return 'Bạn đang cung cấp cường độ mm/h. Cần thời lượng (ví dụ “trong 30 phút”) để tính lượng mưa và số nhịp; không thể dùng trực tiếp mm/h làm tổng mm.';
      const durationValue = parse(duration[1]);
      if (!Number.isFinite(durationValue) || durationValue <= 0) return 'Thời lượng phải lớn hơn 0 giờ hoặc phút để tính kịch bản.';
      const hours = duration[2] === 'phút' ? durationValue / 60 : durationValue;
      mm = measurement * hours;
      if (!Number.isFinite(mm)) return 'Giá trị quá lớn để quy đổi tin cậy; bạn kiểm tra lại số liệu.';
      assumption = `Nếu giữ nguyên tốc độ giả định ${numberText(measurement)} mm/h trong ${numberText(durationValue)} ${duration[2]}, P = ${numberText(measurement)} × ${numberText(hours)} = ${numberText(mm)} mm. Đây là kịch bản tính toán, không phải dự báo thời tiết. `;
      if (!countIntent) return assumption;
    }
    if (factor === null) return 'Cần hệ số hiệu chuẩn (mm/tip) để quy đổi.';
    const count = mm / factor;
    if (!Number.isFinite(count) || count > Number.MAX_SAFE_INTEGER) return 'Giá trị quá lớn để quy đổi tin cậy; bạn kiểm tra lại số liệu.';
    const integer = Math.abs(count - Math.round(count)) < 1e-8;
    const estimate = integer ? `${Math.round(count)} lần tương đương`
      : `${numberText(count)} lần tương đương (khoảng ${Math.round(count)} lần nếu làm tròn; số nhịp thực tế phải là số nguyên)`;
    return `${assumption}Theo lượng mưa bạn cung cấp và ${factorSource} ${numberText(factor)} mm/tip, N = ${numberText(mm)} / ${numberText(factor)} = ${estimate}. Giả sử hệ số không đổi; số nhịp thực cần đối chiếu sự kiện đã lưu, đặc biệt khi có thay đổi hiệu chuẩn.`;
  }

  if (!countIntent || /công thức|nguyên lý|hoạt động|cách.*tính/.test(q)) return null;
  const h = c.rainHistory;
  if (/hôm qua|tuần|tháng|ngày\s*\d|\d{1,2}\/\d{1,2}/.test(q)) {
    return 'Context hiện tại chưa có sự kiện đủ cho ngày hoặc khoảng lịch sử bạn yêu cầu. Cần truy xuất đúng khoảng từ dữ liệu trạm; không thể thay bằng tổng hôm nay hoặc suy ngược với hệ số hiện tại.';
  }
  const rolling = q.match(/(1|3|24)\s*giờ\s*(?:vừa qua|gần nhất|qua|trượt)/) || (/giờ vừa qua|giờ gần nhất/.test(q) ? ['1 giờ', '1'] : null);
  if (rolling) {
    const w = c.rainWindows?.find((w) => w.label === `${rolling[1]} giờ trượt`);
    return w ? describeCount(w, c) : 'Chưa có sự kiện cho cửa sổ giờ trượt này để xác nhận số lần gầu lật; không dùng tổng ngày thay thế.';
  }
  const clockRange = q.match(/từ\s*(\d{1,2})(?:\s*(?:h|giờ|:00))?\s*(?:đến|tới|-)\s*(\d{1,2})(?:\s*(?:h|giờ|:00))?/);
  const clockHour = q.match(/(?:giờ|lúc)\s*(\d{1,2})(?:\s*h)?/) || q.match(/(\d{1,2})\s*h\b/);
  if (clockRange || clockHour) {
    if (/\d{1,2}:\d{2}/.test(q.replace(/:00/g, ''))) return 'Dữ liệu tổng hợp theo giờ hiện chưa đủ chi tiết cho mốc phút này; cần sự kiện gầu trong đúng khoảng để đếm chính xác.';
    const fromHour = Number(clockRange?.[1] ?? clockHour?.[1]);
    const toHour = clockRange ? Number(clockRange[2]) : fromHour + 1;
    if (fromHour < 0 || fromHour > 23 || toHour > 24 || toHour <= fromHour) return 'Khoảng giờ cần nằm trong cùng ngày trạm, từ 00:00 đến 24:00 và giờ kết thúc phải sau giờ bắt đầu.';
    const selected = h?.hourly?.filter((w) => {
      const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: c.timezone, hour: '2-digit', hourCycle: 'h23' }).format(new Date(w.from)));
      return hour >= fromHour && hour < toHour;
    });
    if (!selected?.length) return 'Chưa có bản ghi theo giờ cho khoảng này hoặc khoảng đó chưa đến; chưa thể xác nhận số nhịp, không coi là 0 lần.';
    const complete = selected.length === toHour - fromHour && selected.every((w) => w.coverageComplete && Date.parse(w.to) - Date.parse(w.from) === 3600000);
    return describeCount({ label: `khoảng ${fromHour}:00–${toHour}:00 hôm nay`, from: selected[0].from, to: selected[selected.length - 1].to,
      tips: selected.reduce((s, w) => s + w.tips, 0), rainfallMm: selected.reduce((s, w) => s + w.rainfallMm, 0),
      calibrationFactors: Array.from(new Set(selected.flatMap((w) => w.calibrationFactors))), coverageComplete: complete }, c);
  }
  if (/sáng|chiều|buổi tối|ban đêm/.test(q)) {
    const pattern = /sáng/.test(q) ? /Sáng/ : /chiều/.test(q) ? /Chiều/ : /buổi tối/.test(q) ? /Tối/ : /Đêm/;
    const p = h?.periods.find((p) => pattern.test(p.label));
    if (!p || !p.elapsed || p.tips === undefined) return 'Chưa có số nhịp đã lưu cho buổi được hỏi hoặc buổi đó chưa đến thời gian quan trắc.';
    return describeCount({ ...p, label: p.label, tips: p.tips, calibrationFactors: p.calibrationFactors ?? [], coverageComplete: p.complete }, c);
  }
  if (/giờ này|giờ hiện tại/.test(q)) {
    const w = h?.hourly?.at(-1);
    return w ? describeCount(w, c) : 'Chưa có số nhịp theo giờ hiện tại để trả lời.';
  }
  if (/hôm nay|trong ngày|cả ngày|ngày nay/.test(q)) {
    const tips = h?.recordedTips ?? c.totalTipsToday;
    if (tips === null || tips === undefined || !h) return 'Chưa có số nhịp và lịch sử đủ cho hôm nay. Nếu bạn cung cấp lượng mưa cùng hệ số không đổi, mình có thể tính số lần tương đương.';
    return describeCount({ label: 'từ đầu ngày đến thời điểm chốt dữ liệu', from: h.from, to: h.to,
      tips, rainfallMm: h.recordedTotalMm, calibrationFactors: h.calibrationFactors ?? [], coverageComplete: h.coverageComplete }, c);
  }
  return 'Bạn muốn tính số lần gầu lật trong giờ, buổi hay ngày nào? Có thể đưa lượng mưa (mm) và hệ số (mm/tip); nếu dùng cường độ mm/h thì cần thêm thời lượng.';
}

export function getRainHazardReply(query: string, c: StationContext, now: Date): string | null {
  const q = query.toLowerCase().normalize('NFC');
  if (!/thiên tai|lũ|lụt|ngập|sạt lở|sạt đất|mưa.*(?:kéo dài|liên tục|sắp tới|dẫn tới|dẫn đến|hậu quả|nguy cơ)|(?:sắp tới|thời tiết).*(?:diễn biến|như thế nào)/.test(q)) return null;
  if (c.currentTemp === null && c.currentHumid === null && c.currentPress === null && c.todayRainMm === null) return 'Chưa có báo cáo trạm để đánh giá thực tế. Nếu mưa lớn tiếp tục, nơi trũng/thoát kém có thể ngập; ở lưu vực dốc hoặc gần suối có thể tăng nguy cơ lũ quét/sạt lở. Đây là kịch bản có điều kiện, không xác nhận đang xảy ra thiên tai.';
  return stationAnalysisReply(c, now, query + ' nguy cơ ngập thiên tai');
}
