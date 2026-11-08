/** Shared intent rules for retrieval, local answers and conversation follow-ups. */
export const normalizeQuestionText = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
export type KnowledgeTopic = 'purpose' | 'operation' | 'rain-method' | 'temperature-guide' | 'humidity-guide' | 'pressure-guide';
export const KNOWLEDGE_TOPIC_SECTIONS: Record<KnowledgeTopic, string> = {
  purpose: 'project-overview-2', operation: 'project-overview-0', 'rain-method': 'rain-calibration-3',
  'temperature-guide': 'weather-interpretation-0', 'humidity-guide': 'weather-interpretation-1', 'pressure-guide': 'weather-interpretation-2'
};

export function isMeasurementMethodQuestion(query: string): boolean {
  const q = normalizeQuestionText(query);
  // “độ ẩm như nào” is a reading question; “đo độ ẩm như nào” asks for a method.
  return /lam sao.*do|lam the nao.*do|cach (?:do|tinh)|nguyen ly.*do|(?:do|tinh)\s+(?:luong mua|mua|nhiet do|do am|khi ap|ap suat|cuong do).*(?:nhu (?:the )?nao|the nao|ra sao|kieu gi|bang gi|bang cach nao)|(?:nhiet do|do am|khi ap|ap suat|luong mua).*(?:duoc do|do bang|tinh bang)/.test(q);
}

export function knowledgeQuestionTopics(query: string): KnowledgeTopic[] {
  const q = normalizeQuestionText(query);
  const topics: KnowledgeTopic[] = [];
  const project = /\b(?:du an|tram|he thong|rainsense)\b/.test(q);
  const component = /bmp180|bmp280|bme280|dht11|a3144|hall|oled|nam cham|pheu|gau lat|mach nguon/.test(q);
  const projectFirst = /^(?:(?:vay|the|con)\s+)?(?:du an|tram|he thong|rainsense|muc dich.*(?:du an|tram|he thong))\b/.test(q);
  if (project && (!component || projectFirst) && /muc dich|muc tieu|loi ich|ung dung|giai quyet.*van de|dung.*(?:lam gi|viec gi)|de lam gi|sinh ra.*lam gi/.test(q)) topics.push('purpose');
  const rain = /luong mua|cuong do mua|do mua/.test(q);
  if (rain && (isMeasurementMethodQuestion(q) || /cong thuc|nguyen ly|cach do|cach tinh/.test(q))) topics.push('rain-method');
  if (project && (!component || projectFirst) && /hoat dong|van hanh|luong du lieu/.test(q) && !topics.includes('rain-method')) topics.push('operation');
  if (/nhiet do/.test(q) && /bao nhieu.*(?:mat|lanh|nong|de chiu)|the nao.*(?:mat|lanh|nong)|y nghia|la gi/.test(q) && !isMeasurementMethodQuestion(q)) topics.push('temperature-guide');
  if (/do am|\brh\b/.test(q) && /bao nhieu.*(?:cao|thap|am|kho|tot|ly tuong|binh thuong)|the nao.*(?:cao|thap)|y nghia|la gi/.test(q) && !isMeasurementMethodQuestion(q)) topics.push('humidity-guide');
  if (/khi ap|ap suat/.test(q) && /bao nhieu.*(?:cao|thap|tot|binh thuong)|the nao.*(?:cao|thap)|y nghia|la gi/.test(q) && !isMeasurementMethodQuestion(q)) topics.push('pressure-guide');
  return topics;
}

export function isMetricEvaluationQuestion(query: string): boolean {
  return /thi sao|nhu (?:the )?nao|the nao|co (?:mat|nong|lanh|cao|thap|am|kho|tot|on|binh thuong)|cao hay thap|mat me|oi buc/.test(normalizeQuestionText(query));
}

export function hasSuppliedSensorValue(query: string): boolean {
  return /-?\d+(?:[.,]\d+)?\s*(?:°\s*c|do\s*c|%|hpa\b|pa\b)/.test(normalizeQuestionText(query));
}
