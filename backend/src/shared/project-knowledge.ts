import { KNOWLEDGE_CHUNKS } from './knowledge.generated';
import type { HardwareVariant, KnowledgeSource } from './ai-types';
import type { StationContext } from './rainsense-ai';
import { wantsDetailedAnswer } from './answer-style';

export const foldText = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const stop = new Set('la gi cua va cho thi co khong duoc nhu nao mot nhung cac voi trong toi ban hay the ve nay tai sao bao nhieu'.split(' '));
export type KnowledgeChunk = (typeof KNOWLEDGE_CHUNKS)[number];
const focusedTopics = [
  { pattern: /bmp180|dht11|bmp280|dang dung|hien.*(?:phan cung|cam bien)|cam bien.*(?:nao|gi)|bme280.*(?:thay|con dung)/, id: 'current-firmware-0' },
  { pattern: /chan.*(?:dht|oled|hall)|dht.*gpio|lich doc|chu ky.*doc/, id: 'current-firmware-1' },
  { pattern: /bme280_found|co cam bien|mat dht|dht11.*(?:mat|loi)|bmp180.*(?:mat|loi)/, id: 'current-firmware-2' },
  { pattern: /dien tro.*keo|pull.?up|open.drain|i2c.*(?:chung|song song|dien tro|dia chi)/, id: 'electrical-system-0' },
  { pattern: /mass|gnd|tu loc|nhieu nguon|reset.*wifi|wifi.*reset/, id: 'electrical-system-1' },
  { pattern: /oled.*(?:vai tro|lam gi|luu|mat)|hop bao ve|phu kien.*bao ve/, id: 'electrical-system-2' },
  { pattern: /dien tich|duong kinh|the tich|\bml\b|1\s*mm.*lit/, id: 'rain-metrology-0' },
  { pattern: /can bang|lech.*gau|nam cham|200\s*ms|debounce|khoa.*(?:nhip|dem)/, id: 'rain-metrology-1' },
  { pattern: /do phan giai|mua nho.*(?:khong|chua).*lat|261|7[.,]68|xa nuoc/, id: 'rain-metrology-2' },
  { pattern: /mua gia|khong mua.*lat|rung|suong.*gau/, id: 'rain-metrology-3' },
  { pattern: /nhiet do.*giam.*do am|rh.*tang|diem suong|hoi nuoc/, id: 'atmospheric-physics-0' },
  { pattern: /tu nong|pcb|nhiet.*(?:lech|cao.*ngoai)|cam bien.*nong/, id: 'atmospheric-physics-1' },
  { pattern: /muc nuoc bien|do cao|1013|\bpa\b|hpa.*(?:la gi|nghia)|khi ap.*(?:chu ky|ngay)/, id: 'atmospheric-physics-2' },
  { pattern: /heat index|nhiet do cam nhan/, id: 'atmospheric-physics-3' },
  { pattern: /du bao.*(?:thong so|cam bien)|(?:thong so|cam bien).*du bao|co chac.*mua|ngung tu/, id: 'weather-reasoning-0' },
  { pattern: /cach.*(?:du bao|phan tich)|du an.*(?:phan tich|du bao)/, id: 'weather-reasoning-1' }
];
export const knowledgeDocumentCount = () => new Set(KNOWLEDGE_CHUNKS.map((d) => d.documentId)).size;

function electricalIntent(q: string) {
  const power = /nguon|dien ap|\bvdd(?:io)?\b|\b(?:3[.,]3|5)\s*v\b|\bcap\s+(?:dien|nguon)/.test(q);
  if (power) {
    const bme = /bme280/.test(q);
    const hall = /a3144|hall/.test(q);
    return bme && !hall ? 'bme-power' : hall && !bme ? 'hall-power' : 'unknown-power';
  }
  return /dau noi|noi chan|so do|\bgpio\b|\bsda\b|\bscl\b/.test(q) ? 'pinout' : null;
}
export function knowledgeSource(chunk: KnowledgeChunk): KnowledgeSource {
  return { id: chunk.id, title: chunk.title, version: chunk.version, path: chunk.path, url: chunk.source };
}

export function isProjectExplanationQuery(query: string): boolean {
  const q = foldText(query);
  return /la gi|tai sao|vi sao|giai thich|y nghia|khac nhau|co chac|co phai|nguyen ly|hoat dong|vai tro|anh huong|cach|hieu chuan|dau noi|noi chan|so do|dien ap|nguon|dien tro|mass|gnd|chu ky|lich doc|doc.*bao lau/.test(q)
    || /bme280|bmp180|bmp280|dht11|hall|a3144|oled/.test(q) && /co do|do duoc|lam gi|dung.*gi/.test(q);
}

/** Local lexical RAG: only the curated, build-time approved corpus is searchable. */
export function searchProjectDocs(query: string, variant: HardwareVariant = 'unknown', limit = 3): KnowledgeChunk[] {
  const tokens = Array.from(new Set(foldText(query).match(/[a-z0-9]+(?:[.,][0-9]+)?/g) ?? [])).filter((s) => s.length > 1 && !stop.has(s));
  if (!tokens.length) return [];
  const q = foldText(query);
  const entities = q.match(/bme280|bmp180|bmp280|dht11|a3144|sh1106|oled|mqtt|esp32(?:-s3)?/g) ?? [];
  const wiring = /dau noi|noi chan|so do|gpio|sda|scl/.test(q);
  const pool = KNOWLEDGE_CHUNKS.filter((d) => d.status === 'verified' && (d.hardwareVariant === 'all' || String(d.hardwareVariant) === variant) &&
    (!entities.length || entities.some((entity) => foldText(`${d.title} ${d.text}`).includes(entity)) || wiring && d.documentId === 'wiring-cautions'));
  return pool.map((d) => {
    const title = foldText(d.title);
    const body = foldText(d.text);
    const keywords = foldText(d.keywords.join(' '));
    const words = new Set(`${title} ${body}`.match(/[a-z0-9]+/g));
    let score = tokens.reduce((sum, token) => {
      if (!words.has(token)) return sum;
      const idf = Math.log(1 + pool.length / (1 + pool.filter((p) => foldText(`${p.title} ${p.text}`).includes(token)).length));
      return sum + idf * (1 + (title.includes(token) ? 3 : 0) + (keywords.includes(token) ? 0.5 : 0));
    }, 0);
    if (/bme280/.test(q) && /do.*mua|la gi/.test(q) && d.id === 'hardware-bom-0') score += 20;
    if (/gau.*lat/.test(q) && /hoat dong|nguyen ly|nam cham/.test(q) && d.id === 'hardware-bom-1') score += 20;
    const electrical = electricalIntent(q);
    if (electrical === 'pinout' && d.id === 'wiring-cautions-0') score += 30;
    if (electrical === 'hall-power' && d.id === 'wiring-cautions-1') score += 30;
    if (electrical === 'bme-power' && d.documentId === 'bme280-power') score += 40;
    for (const topic of focusedTopics) if (topic.pattern.test(q) && topic.id === d.id) score += 45;
    return { d, score };
  }).filter((p) => p.score > 0).sort((a, b) => b.score - a.score || a.d.id.localeCompare(b.d.id))
    .filter((p, _, all) => p.score >= all[0].score * 0.35).slice(0, Math.max(1, Math.min(limit, 5))).map((p) => p.d);
}

export function getProjectKnowledgeReply(query: string, context: StationContext): string | null {
  const q = foldText(query);
  const technical = /esp32|bmp180|bmp280|dht11|bme280|a3144|hall|oled|mqtt|broker|firmware|gpio|sda|scl|dau noi|noi chan|so do|phu kien|linh kien|cam bien|nam cham|pheu|dien tro|i2c|tu loc|mass|gnd|mach|hieu chuan|nguyen ly|\bgau\b|khoa dem|debounce|luong hoat dong|du an hoat dong|tu nuoc mua/.test(q);
  if (/cong thuc/.test(q)) return null; // Preserve the configured factor in the existing formula reply.
  const explanation = /la gi|tai sao|vi sao|giai thich|y nghia|khac nhau|co chac|co phai|nguyen ly|cach (?:tinh|do|hoat dong|du bao|phan tich)|do phan giai/.test(q);
  if (/hien tai|hom nay|luc nay|dang do/.test(q) && !explanation && !/dang dung|phan cung|phien ban|linh kien|mach|cam bien.*(?:gi|nao)|du an/.test(q)) return null;
  if (!technical && !explanation) return null;
  if (/gau|mua/.test(q) && /ngung|ngun|nghi|mua lai|sang|chieu|hom nay|reset|ve 0|khong tang/.test(q) && !/nguyen ly|hoat dong/.test(q)) return null;
  if (/du bao|ngay mai|chieu mai/.test(q) && !explanation) return null;
  if (/dang dung|hien.*(?:phan cung|cam bien)|cam bien.*(?:nao|gi)/.test(q) && context.profile?.environmentSensors && context.profile.environmentSensors !== 'unknown') {
    return context.profile.environmentSensors === 'bme280'
      ? 'Theo hồ sơ trạm đã cấu hình, bộ cảm biến môi trường là BME280, đo nhiệt độ, RH và khí áp; Hall A3144 cùng gầu lật đo nhịp nước. Đây là cấu hình hồ sơ, cần đối chiếu firmware đã nạp và dây thực tế khi thay phần cứng.'
      : 'Theo hồ sơ trạm đã cấu hình, bộ cảm biến là BMP180 + DHT11: BMP180 cung cấp khí áp/nhiệt độ, DHT11 cung cấp RH; nhiệt độ có thể dự phòng từ DHT11 theo firmware. Hall A3144 cùng gầu lật đo nhịp nước. Cần đối chiếu firmware đã nạp và đấu nối thực tế khi thay phần cứng.';
  }
  let chunks = searchProjectDocs(query, context.profile?.hardwareVariant);
  const electrical = electricalIntent(q);
  if (electrical === 'unknown-power' && /bme280/.test(q) && /hall|a3144/.test(q)) return 'Hai IC có yêu cầu nguồn khác nhau: BME280 dùng VDD 1,71–3,6 V, VDDIO 1,2–3,6 V; Hall A3144 Allegro dùng nguồn 4,5–24 V và OUT open-collector. Nguồn cảm biến và mức logic OUT phải kiểm tra riêng: GPIO ESP32-S3 dùng mức 3,3 V, không kéo OUT lên 5 V trực tiếp. Module có ổn áp có thể khác IC rời; cần đối chiếu đúng model.';
  if (electrical === 'bme-power') return KNOWLEDGE_CHUNKS.find((d) => d.documentId === 'bme280-power')?.text ?? null;
  if (electrical === 'unknown-power') return 'Cần xác định đúng tên IC hoặc model module và chân cấp nguồn đang hỏi. Điện áp VIN của module có bộ ổn áp có thể khác điện áp của IC; không dùng dải nguồn của Hall A3144 cho BME280, OLED hoặc ESP32-S3. Hãy đối chiếu sơ đồ của đúng module trước khi cấp điện.';
  if (electrical === 'pinout' || electrical === 'hall-power') {
    chunks = KNOWLEDGE_CHUNKS.filter((d) => electrical === 'hall-power' ? d.id === 'wiring-cautions-1' : d.id === 'wiring-cautions-0');
    const verified = context.profile?.wiringVerified === true && context.profile.hardwareVariant === 'oled-s3';
    const power = electrical === 'hall-power';
    const prefix = power ? 'Cần xác định đúng IC rời hoặc module đang lắp. ' : verified ? 'Theo hồ sơ trạm đã xác minh: bản OLED dùng SDA8, SCL9 và Hall10. ' : 'Chưa xác minh đấu nối thực tế của trạm; các chân dưới đây chỉ mô tả mã trong repository. ';
    return prefix + chunks.map((d) => d.text).join('\n\n');
  }
  if (!chunks.length) return null;
  // Keep the local answer focused; the LLM can combine more retrieved sections when available.
  return (wantsDetailedAnswer(query) ? chunks.slice(0, 3) : chunks.slice(0, 1)).map((d) => d.text).join('\n\n');
}

export function getWeatherFeatureReply(query: string, context: StationContext): string | null {
  const q = foldText(query);
  if (!/xu huong|thay doi|tang hay giam|giam bao nhieu|tang bao nhieu|trung binh|cao nhat|thap nhat/.test(q)) return null;
  const f = context.weatherFeatures;
  if (!/khi ap|ap suat|nhiet do|do am/.test(q)) return null;
  if (!f || f.sampleCount === 0) return 'Chưa có chuỗi quan trắc hợp lệ để tính xu hướng hoặc thống kê môi trường tại trạm.';
  const format = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: context.timezone, hour12: false });
  const intro = `Theo ${f.sampleCount} bản đo hợp lệ của trạm ${context.stationName} (${context.deviceId}), từ ${format(f.from)} đến ${format(f.to)}: `;
  const caution = `${f.coverageComplete ? '' : 'Khoảng dữ liệu chưa được phủ liên tục; thống kê chỉ phản ánh phần đã ghi nhận. '}${context.dataQuality?.historyTruncated ? 'Kết quả truy vấn đã chạm giới hạn số bản ghi và có thể thiếu lịch sử. ' : ''}${context.dataQuality?.fresh === false ? 'Bản đo mới nhất chưa đủ mới hoặc trạm ngoại tuyến. ' : ''}`;
  if (/khi ap|ap suat/.test(q) && /xu huong|thay doi|tang|giam/.test(q)) {
    return `${intro}${context.pressureTrend}. ${caution}Đây là xu hướng quan trắc, chưa đủ để xác nhận bão hay dự báo giờ mưa.`;
  }
  const key = /nhiet do/.test(q) ? 'temperature' : /do am/.test(q) ? 'humidity' : 'pressure';
  const unit = key === 'temperature' ? '°C' : key === 'humidity' ? '%' : 'hPa';
  const stats = f[key];
  if (!stats) return 'Chưa có chuỗi số đo hợp lệ cho đại lượng được hỏi.';
  return `${intro}thấp nhất ${stats.min} ${unit}, cao nhất ${stats.max} ${unit}, trung bình ${stats.avg} ${unit}. ${caution}`;
}
