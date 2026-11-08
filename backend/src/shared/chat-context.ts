import type { ChatTurn } from './rainsense-ai';
import { foldText, isProjectExplanationQuery } from './project-knowledge';
import { hasFutureTime } from './time-request';

const followUp = /^(?:vay|the|con|neu vay|thi|no|cai nay|bo phan nay|linh kien nay)\b/;
const hasDay = /hom nay|hom qua|(?:sang|chieu|toi|dem) nay|hien tai|luc nay|ngay mai|chieu mai|toi mai|sang mai|ngay kia|\bmai\b|ngay\s*\d|\d{1,2}[/-]\d{1,2}/;
const isForecast = /du bao|ngay mai|chieu mai|toi mai|sang mai|ngay kia|gio toi|xac suat.*mua/;

function resolveAgainst(message: string, previous: string): string {
  const q = foldText(message.trim());
  if (!previous || !followUp.test(q) || q.length > 180) return message;
  const p = foldText(previous);
  const methodFollowup = /lam sao|lam the nao|bang gi|nguyen ly|hoat dong|cach do|do.*bang/.test(q);
  const hardware = q.match(/bmp180|bmp280|dht11|bme280|a3144|hall|oled|esp32(?:-s3)?|mqtt/g);
  // An explicit new hardware topic must not inherit an earlier weather forecast.
  if (hardware?.length) return message;
  if (isProjectExplanationQuery(message) && /nhiet do|do am|khi ap|ap suat|tram|mach|phu kien|linh kien|gau|pheu/.test(q)) return message;
  if ((isForecast.test(p) || hasFutureTime(p)) && !methodFollowup && !/hien tai|luc nay|bay gio|dang do|dang mua|hom qua|vua qua|gan nhat/.test(q)) {
    const day = hasDay.test(q) ? '' : /ngay kia/.test(p) ? 'ngày kia' : /\bmai\b/.test(p) ? 'ngày mai' : /hom nay|toi nay/.test(p) ? 'hôm nay' : '';
    const evening = /tối/i.test(message) && !/toi nay|toi mai|buoi toi|toi ngay/.test(q) ? ', buổi tối' : '';
    return `Dự báo ${message}${evening}${day ? ` (${day})` : ''}`;
  }
  if (/nguon|dien ap|dau noi|noi chan|nguyen ly/.test(q)) {
    const entities = Array.from(new Set(p.match(/bmp180|bmp280|dht11|bme280|a3144|oled|esp32-s3/g) ?? []));
    if (entities.length === 1) return `${message} (${entities[0].toUpperCase()})`;
  }
  const subjects = Array.from(new Set(p.match(/bmp180|bmp280|dht11|bme280|a3144|oled|esp32-s3|gau lat|pheu|nam cham/g) ?? []));
  if (subjects.length === 1 && /hoat dong|nguyen ly|dung.*gi|lam.*gi|lam sao|lam the nao|do.*bang|vai tro|co do|do duoc|dien tro|keo len|nguon|dien ap/.test(q)) return `${message} (${subjects[0]})`;
  const topics = [
    { pattern: /nhiet do/, label: 'nhiệt độ' }, { pattern: /do am/, label: 'độ ẩm' },
    { pattern: /khi ap|ap suat/, label: 'khí áp' }, { pattern: /luong mua/, label: 'lượng mưa' }
  ];
  const explicitTopic = topics.some((topic) => topic.pattern.test(q));
  const previousTopics = topics.filter((topic) => topic.pattern.test(p));
  if (methodFollowup && !explicitTopic && previousTopics.length) return `${message} (${previousTopics.map((t) => t.label).join(', ')})`;
  if (explicitTopic || previousTopics.length && /gio|tieng|phut|ngay|hom|hien tai|luc nay|trung binh|cao nhat|thap nhat|xu huong|sang|chieu|toi|dem/.test(q)) {
    const explicitTime = /(?:\d+|mot|hai|ba|bon|nam|sau|bay|nua)\s*(?:gio|tieng|phut|h\b)|hom qua|hom nay|hien tai|luc nay|bay gio|\btu\s*\d|tuan|thang|(?:sang|chieu|toi|dem) nay/.test(q);
    const range = explicitTime ? '' : previous.match(/(?:\d+|một|hai|ba|bốn|năm|sáu|bảy|nửa)\s*(?:giờ|tiếng|phút)(?:\s*rưỡi|\s*(?:và\s*)?\d+\s*phút)?\s*(?:vừa qua|gần nhất|qua)?|(?:buổi\s*)?(?:sáng|chiều|tối|đêm)\s*(?:nay|hôm qua)|hôm qua|hôm nay/i)?.[0] ?? '';
    return `${message}${!explicitTopic ? ` (${previousTopics.map((t) => t.label).join(', ')})` : ''}${range ? `, ${range}` : ''}`;
  }
  if (/sang|chieu|buoi|gio|hom nay/.test(q) && /gau.*lat|so nhip/.test(p)) return `${message}, số lần gầu lật`;
  if (/sang|chieu|buoi|gio/.test(q) && /mua/.test(p)) return `${message}, lượng mưa`;
  return message;
}

/** Carry subjects and periods from user turns only; never copy old sensor readings. */
export function resolveChatQuestion(message: string, history: ChatTurn[]): string {
  let previous = '';
  for (const turn of history.slice(-8)) {
    if (turn.role === 'user' && typeof turn.content === 'string') previous = resolveAgainst(turn.content, previous);
  }
  return resolveAgainst(message, previous);
}
