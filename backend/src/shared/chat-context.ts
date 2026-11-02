import type { ChatTurn } from './rainsense-ai';
import { foldText } from './project-knowledge';

const followUp = /^(?:vay|the|con|neu vay|thi)\b/;
const hasDay = /hom nay|hom qua|(?:sang|chieu|toi|dem) nay|hien tai|luc nay|ngay mai|chieu mai|toi mai|sang mai|ngay kia|\bmai\b|ngay\s*\d|\d{1,2}[/-]\d{1,2}/;
const isForecast = /du bao|ngay mai|chieu mai|toi mai|sang mai|ngay kia|gio toi|xac suat.*mua/;

function resolveAgainst(message: string, previous: string): string {
  const q = foldText(message.trim());
  if (!previous || !followUp.test(q) || q.length > 180) return message;
  const p = foldText(previous);
  const hardware = q.match(/bme280|a3144|hall|oled|esp32(?:-s3)?|mqtt/g);
  // An explicit new hardware topic must not inherit an earlier weather forecast.
  if (hardware?.length) return message;
  if (isForecast.test(p) && !/hien tai|luc nay|dang do|hom qua/.test(q)) {
    const day = hasDay.test(q) ? '' : /ngay kia/.test(p) ? 'ngày kia' : /\bmai\b/.test(p) ? 'ngày mai' : /hom nay|toi nay/.test(p) ? 'hôm nay' : '';
    const evening = /tối/i.test(message) && !/toi nay|toi mai|buoi toi|toi ngay/.test(q) ? ', buổi tối' : '';
    return `Dự báo ${message}${evening}${day ? ` (${day})` : ''}`;
  }
  if (/nguon|dien ap|dau noi|noi chan|nguyen ly/.test(q)) {
    const entities = Array.from(new Set(p.match(/bme280|a3144|oled|esp32-s3/g) ?? []));
    if (entities.length === 1) return `${message} (${entities[0].toUpperCase()})`;
  }
  const topics = [
    { pattern: /nhiet do/, label: 'nhiệt độ' }, { pattern: /do am/, label: 'độ ẩm' },
    { pattern: /khi ap|ap suat/, label: 'khí áp' }
  ];
  const explicitTopic = topics.some((topic) => topic.pattern.test(q));
  const previousTopics = topics.filter((topic) => topic.pattern.test(p));
  if (explicitTopic || previousTopics.length === 1) {
    const range = /\d+\s*gio|hom qua|hom nay/.test(q) ? '' : previous.match(/\d+\s*giờ\s*(?:vừa qua|gần nhất|qua)|hôm qua|hôm nay/i)?.[0] ?? '';
    return `${message}${!explicitTopic ? ` (${previousTopics[0].label})` : ''}${range ? `, ${range}` : ''}`;
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
