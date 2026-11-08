import { foldText } from './project-knowledge';

export function normalizeTimePhrase(text: string): string {
  const words: Record<string, number> = { mot: 1, hai: 2, ba: 3, bon: 4, nam: 5, sau: 6, bay: 7 };
  return foldText(text)
    .replace(/\b(mot|hai|ba|bon|nam|sau|bay)\s+(?=gio\b|tieng\b|phut\b|ngay\b)/g, (_, word: string) => `${words[word]} `)
    .replace(/\bnua\s+(gio|tieng)\b/g, '0.5 $1')
    .replace(/(\d+(?:[.,]\d+)?)\s*(gio|tieng)\s+ruoi\b/g, (_, count: string, unit: string) => `${Number(count.replace(',', '.')) + 0.5} ${unit}`);
}

export const hasFutureTime = (q: string) => /ngay mai|chieu mai|sang mai|toi mai|ngay kia|sap toi|(?:gio|tieng|phut|ngay|h)\s*(?:toi|tiep theo|nua)\b(?!\s*\d)/.test(q);

export type ParsedDuration = { status: 'none' } | { status: 'invalid' } | { status: 'ready'; milliseconds: number };
/** Sum a single compound duration; never silently choose the first of competing intervals. */
export function parseTimeDuration(q: string): ParsedDuration {
  const matches = Array.from(q.matchAll(/(-?\d+(?:[.,]\d+)?)\s*(ngay|tieng|gio|phut|h)\b/g));
  if (!matches.length) return { status: 'none' };
  const seen = new Set<number>();
  let milliseconds = 0;
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const unit = m[2] === 'ngay' ? 86400000 : m[2] === 'phut' ? 60000 : 3600000;
    if (seen.has(unit) || i > 0 && !/^\s*(?:va\s*)?$/.test(q.slice(matches[i - 1].index! + matches[i - 1][0].length, m.index))) return { status: 'invalid' };
    seen.add(unit);
    const count = Number(m[1].replace(',', '.'));
    if (!Number.isFinite(count) || count < 0) return { status: 'invalid' };
    milliseconds += count * unit;
  }
  return Number.isFinite(milliseconds) && milliseconds > 0 ? { status: 'ready', milliseconds } : { status: 'invalid' };
}
