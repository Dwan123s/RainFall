import { KNOWLEDGE_CHUNKS } from './knowledge.generated';
import type { HardwareVariant, KnowledgeSource } from './ai-types';
import type { StationContext } from './rainsense-ai';

export const foldText = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const stop = new Set('la gi cua va cho thi co khong duoc nhu nao mot nhung cac voi trong toi ban hay the ve nay tai sao bao nhieu'.split(' '));
export type KnowledgeChunk = (typeof KNOWLEDGE_CHUNKS)[number];
export function knowledgeSource(chunk: KnowledgeChunk): KnowledgeSource {
  return { id: chunk.id, title: chunk.title, version: chunk.version, path: chunk.path, url: chunk.source };
}

/** Local lexical RAG: only the curated, build-time approved corpus is searchable. */
export function searchProjectDocs(query: string, variant: HardwareVariant = 'unknown', limit = 3): KnowledgeChunk[] {
  const tokens = Array.from(new Set(foldText(query).match(/[a-z0-9]+(?:[.,][0-9]+)?/g) ?? [])).filter((s) => s.length > 1 && !stop.has(s));
  if (!tokens.length) return [];
  const q = foldText(query);
  const entities = q.match(/bme280|a3144|sh1106|oled|mqtt|esp32(?:-s3)?/g) ?? [];
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
    if (wiring && d.id === 'wiring-cautions-0') score += 20;
    if (/a3144|hall/.test(q) && /nguon|cap|dien ap|[35][.,]?\d?\s*v/.test(q) && d.id === 'wiring-cautions-1') score += 30;
    return { d, score };
  }).filter((p) => p.score > 0).sort((a, b) => b.score - a.score || a.d.id.localeCompare(b.d.id))
    .filter((p, _, all) => p.score >= all[0].score * 0.35).slice(0, Math.max(1, Math.min(limit, 5))).map((p) => p.d);
}

export function getProjectKnowledgeReply(query: string, context: StationContext): string | null {
  const q = foldText(query);
  const technical = /esp32|bme280|a3144|hall|oled|mqtt|broker|firmware|gpio|sda|scl|dau noi|noi chan|so do|phu kien|linh kien|nam cham|pheu|hieu chuan|nguyen ly|gau.*lat|luong hoat dong|du an hoat dong|tu nuoc mua/.test(q);
  if (/cong thuc/.test(q)) return null; // Preserve the configured factor in the existing formula reply.
  const explanation = /la gi|tai sao|vi sao|giai thich|y nghia|khac nhau|nguyen ly|cach (?:tinh|do|hoat dong)|do phan giai/.test(q);
  if (/hien tai|hom nay|luc nay|dang do/.test(q) && !explanation) return null;
  if (!technical && !explanation) return null;
  if (/gau|mua/.test(q) && /ngung|ngun|nghi|mua lai|sang|chieu|hom nay|reset|ve 0|khong tang/.test(q) && !/nguyen ly|hoat dong/.test(q)) return null;
  if (/du bao|ngay mai|chieu mai/.test(q) && !explanation) return null;
  let chunks = searchProjectDocs(query, context.profile?.hardwareVariant);
  if (/dau noi|noi chan|so do|gpio|sda|scl|cap.*(?:nguon|v)|3[.,]3\s*v/.test(q)) {
    chunks = KNOWLEDGE_CHUNKS.filter((d) => d.documentId === 'wiring-cautions').slice(/a3144|hall|cap|nguon|3[.,]3/.test(q) ? 1 : 0, /a3144|hall|cap|nguon|3[.,]3/.test(q) ? 2 : 1);
    const verified = context.profile?.wiringVerified === true && context.profile.hardwareVariant === 'oled-s3';
    const power = /a3144|hall|cap|nguon|3[.,]3/.test(q);
    const prefix = power ? 'Cần xác định đúng IC rời hoặc module đang lắp. ' : verified ? 'Theo hồ sơ trạm đã xác minh: bản OLED dùng SDA8, SCL9 và Hall10. ' : 'Chưa xác minh đấu nối thực tế của trạm; các chân dưới đây chỉ mô tả mã trong repository. ';
    return prefix + chunks.map((d) => d.text).join('\n\n');
  }
  if (!chunks.length) return null;
  // Keep the local answer focused; the LLM can combine more retrieved sections when available.
  return chunks[0].text;
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
