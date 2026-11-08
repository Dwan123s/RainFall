import type { RainEventRecord } from '../shared/types/rain';
import type { RainHistory, RainWindow } from '../shared/rainsense-ai';
import { getStartOfDayInTimezone } from '../shared/utils/time';

const MINUTE = 60000;
const round = (n: number) => Math.round(n * 100) / 100;
// An interval batch wholly inside a window supports its mean, without inventing per-tip timestamps.
const uncertainWithin = (e: RainEventRecord, start: number, end: number) => e.timingQuality !== 'device_tip' &&
  !(e.timingQuality === 'telemetry_interval' && e.intervalFrom && Date.parse(e.intervalFrom) >= start && Date.parse(e.intervalFrom) <= Date.parse(e.timestamp) && Date.parse(e.timestamp) <= end);

export function summarizeRainWindow(
  events: RainEventRecord[], telemetryTimes: string[], from: Date, to: Date, label: string, maxGapMs = 120000, includeEnd = false
): RainWindow {
  const start = from.getTime();
  const end = to.getTime();
  const allSelected = events.filter((e) => Date.parse(e.timestamp) >= start && (includeEnd ? Date.parse(e.timestamp) <= end : Date.parse(e.timestamp) < end) &&
    Number.isFinite(e.rainfallMm) && e.rainfallMm >= 0 && Number.isSafeInteger(e.tipCount) && e.tipCount > 0);
  const selected = allSelected.filter((e) => e.dataKind !== 'test');
  const tests = allSelected.filter((e) => e.dataKind === 'test');
  const samples = telemetryTimes.map(Date.parse).filter(Number.isFinite).sort((a, b) => a - b);
  const before = samples.filter((t) => t <= start).pop();
  const after = samples.find((t) => t >= end);
  const inside = samples.filter((t) => t > start && t < end);
  const points = [before ?? inside[0], ...inside, after ?? inside.at(-1)].filter((t): t is number => t !== undefined);
  const coverageComplete = end > start && points.length > 0 && Math.abs(points[0] - start) <= maxGapMs &&
    Math.abs(end - points[points.length - 1]) <= maxGapMs && points.every((t, i) => i === 0 || t - points[i - 1] <= maxGapMs);
  const spans: number[][] = [];
  for (const stamp of [...new Set(samples.filter((t) => t >= start && t <= end))]) {
    const last = spans.at(-1);
    if (!last || stamp - last.at(-1)! > maxGapMs) spans.push([stamp]);
    else last.push(stamp);
  }
  const observedSegments = spans.filter((span) => span.at(-1)! > span[0]).map((span) => {
    const first = span[0], last = span.at(-1)!;
    const recorded = selected.filter((e) => Date.parse(e.timestamp) >= first && Date.parse(e.timestamp) <= last);
    return { from: new Date(first).toISOString(), to: new Date(last).toISOString(),
      rainfallMm: round(recorded.reduce((s, e) => s + e.rainfallMm, 0)), tips: recorded.reduce((s, e) => s + e.tipCount, 0),
      uncertainTimingEvents: recorded.filter((e) => uncertainWithin(e, first, last)).length };
  });
  return { label, from: from.toISOString(), to: to.toISOString(), coverageComplete,
    observedSegments,
    testRainfallMm: round(tests.reduce((s, e) => s + e.rainfallMm, 0)), testTips: tests.reduce((s, e) => s + e.tipCount, 0),
    uncertainTimingEvents: selected.filter((e) => uncertainWithin(e, start, end)).length,
    rainfallMm: round(selected.reduce((s, e) => s + e.rainfallMm, 0)),
    tips: selected.reduce((s, e) => s + e.tipCount, 0), calibrationFactors: [...new Set(selected.map((e) => e.calibrationFactor))] };
}

/** No tip means unknown weather unless telemetry covers the interval. */
export function summarizeRainHistory(
  events: RainEventRecord[], telemetryTimes: string[], now: Date,
  timezone: string, maxTelemetryGapMs = 120000
): RainHistory {
  const start = getStartOfDayInTimezone(now, timezone).getTime();
  const end = now.getTime();
  const samples = telemetryTimes.map(Date.parse).filter((t) => Number.isFinite(t) && t >= start && t <= end).sort((a, b) => a - b);
  const covered = (from: number, to: number) => {
    if (to <= from) return false;
    const before = samples.filter((t) => t <= from).pop();
    const after = samples.find((t) => t >= to);
    const inside = samples.filter((t) => t > from && t < to);
    const points = [before ?? inside[0], ...inside, after ?? inside[inside.length - 1]].filter((t): t is number => t !== undefined);
    return points.length > 0 && points[0] - from <= maxTelemetryGapMs && to - points[points.length - 1] <= maxTelemetryGapMs &&
      points.every((t, i) => i === 0 || t - points[i - 1] <= maxTelemetryGapMs);
  };
  const sorted = events.filter((e) => {
    const t = Date.parse(e.timestamp);
    return e.dataKind !== 'test' && t >= start && t <= end && Number.isFinite(e.rainfallMm) && e.rainfallMm >= 0 && e.tipCount > 0;
  }).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const episodes: RainHistory['episodes'] = [];
  const gaps: RainHistory['gaps'] = [];
  for (const e of sorted) {
    const last = episodes[episodes.length - 1];
    if (!last || Date.parse(e.timestamp) - Date.parse(last.to) > 20 * MINUTE) {
      if (last) gaps.push({ from: last.to, to: e.timestamp,
        minutes: Math.round((Date.parse(e.timestamp) - Date.parse(last.to)) / MINUTE),
        telemetryComplete: covered(Date.parse(last.to), Date.parse(e.timestamp)) });
      episodes.push({ from: e.timestamp, to: e.timestamp, rainfallMm: e.rainfallMm });
    } else {
      last.to = e.timestamp;
      last.rainfallMm = round(last.rainfallMm + e.rainfallMm);
    }
  }
  const periods = [
    { label: 'Đêm (00:00–06:00)', hour: 0 }, { label: 'Sáng (06:00–12:00)', hour: 6 },
    { label: 'Chiều (12:00–18:00)', hour: 12 }, { label: 'Tối (18:00–24:00)', hour: 18 }
  ].map(({ label, hour }) => {
    const from = start + hour * 3600000;
    const to = from + 6 * 3600000;
    const selected = sorted.filter((e) => Date.parse(e.timestamp) >= from && Date.parse(e.timestamp) < to);
    return { label, from: new Date(from).toISOString(), to: new Date(Math.min(to, Math.max(from, end))).toISOString(),
      elapsed: end > from, complete: end >= to && covered(from, to),
      tips: selected.reduce((s, e) => s + e.tipCount, 0), calibrationFactors: [...new Set(selected.map((e) => e.calibrationFactor))],
      rainfallMm: round(selected.reduce((sum, e) => sum + e.rainfallMm, 0)) };
  });
  const hourly: RainWindow[] = [];
  for (let from = start; from < end; from += 3600000) {
    hourly.push(summarizeRainWindow(sorted, telemetryTimes, new Date(from), new Date(Math.min(from + 3600000, end)),
      'giờ đồng hồ hôm nay', maxTelemetryGapMs, end < from + 3600000));
  }
  return { timezone, from: new Date(start).toISOString(), to: now.toISOString(), coverageComplete: covered(start, end),
    recordedTips: sorted.reduce((s, e) => s + e.tipCount, 0), calibrationFactors: [...new Set(sorted.map((e) => e.calibrationFactor))], hourly,
    recordedTotalMm: round(sorted.reduce((sum, e) => sum + e.rainfallMm, 0)), periods, episodes, gaps };
}
