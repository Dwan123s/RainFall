import { foldText } from './project-knowledge';

/** Geometry/volume arithmetic is reproducible and does not require a language model. */
export function getCalibrationReply(query: string): string | null {
  const q = foldText(query).replace(/²/g, '2').replace(/³/g, '3');
  if (!/hieu chuan|tinh.*he so|tim.*he so/.test(q) || !/\bml\b|\bcm3\b/.test(q)) return null;
  const number = '(-?\\d+(?:[.,]\\d+)?)';
  const volumes = Array.from(q.matchAll(new RegExp(`${number}\\s*(?:ml|cm3)\\b`, 'g')));
  const areas = Array.from(q.matchAll(new RegExp(`${number}\\s*cm\\^?2\\b`, 'g')));
  const diameter = q.match(new RegExp(`duong kinh\\s*(?:la|=|:)?\\s*${number}\\s*cm\\b`));
  const tips = Array.from(q.matchAll(new RegExp(`${number}\\s*(?:lan|nhip|tips?)\\b`, 'g')));
  if (!volumes.length || !tips.length || !areas.length && !diameter) return 'Để tính hiệu chuẩn, cần thể tích nước V (mL), diện tích miệng phễu A (cm²) hoặc đường kính phễu tròn (cm), và số nhịp N. Công thức k = 10V/(A×N), đơn vị mm/lần.';
  if (volumes.length !== 1 || tips.length !== 1 || areas.length > 1 || areas.length && diameter) return 'Cần một bộ V, A (hoặc đường kính), N cho mỗi lần hiệu chuẩn. Hãy gửi từng phép thử để tính riêng và đối chiếu độ lặp lại.';
  const parse = (s: string) => Number(s.replace(',', '.'));
  const v = parse(volumes[0][1]), n = parse(tips[0][1]);
  const d = diameter ? parse(diameter[1]) : null;
  const a = areas.length ? parse(areas[0][1]) : Math.PI * (d! / 2) ** 2;
  if (!Number.isFinite(v) || v <= 0 || !Number.isFinite(a) || a <= 0 || d !== null && d <= 0 || !Number.isSafeInteger(n) || n <= 0) return 'V và diện tích/đường kính phải lớn hơn 0; số nhịp N phải là số nguyên dương. Kiểm tra lại các giá trị trước khi tính hiệu chuẩn.';
  const k = 10 * v / (a * n);
  if (!Number.isFinite(k) || k <= 0) return 'Giá trị quá lớn hoặc quá nhỏ để tính hệ số tin cậy; hãy kiểm tra lại đơn vị và số liệu.';
  const show = (x: number) => Number(x.toPrecision(7)).toString();
  return `${d === null ? '' : `Phễu tròn có A = π×${show(d)}²/4 ≈ ${show(a)} cm². `}Hệ số tính từ phép thử: k = 10×${show(v)}/(${show(a)}×${n}) ≈ ${show(k)} mm/lần. Đây là kết quả theo số liệu bạn cung cấp, chưa thay đổi cấu hình trạm. Lặp lại ở vài lưu lượng, giữ phễu/gầu cân bằng và kiểm tra một lần lật tương ứng một nhịp.`;
}
