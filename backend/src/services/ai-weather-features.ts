import type { MeasurementRecord } from '../shared/types/telemetry';
import type { WeatherFeatures } from '../shared/ai-types';
import { classifyPressureTrend } from '../shared/utils/weather-calc';

const round = (n: number) => Math.round(n * 100) / 100;
const validValue = (m: MeasurementRecord, key: 'temperature' | 'humidity' | 'pressure') => {
  const [min, max] = key === 'temperature' ? [-40, 85] : key === 'humidity' ? [0, 100] : [300, 1100];
  return Number.isFinite(m[key]) && m[key] >= min && m[key] <= max;
};
const valid = (m: MeasurementRecord) => Number.isFinite(Date.parse(m.timestamp)) &&
  validValue(m, 'temperature') && validValue(m, 'humidity') && validValue(m, 'pressure');

export function calculateWeatherFeatures(records: MeasurementRecord[], from: Date, to: Date, maxGapMs: number): WeatherFeatures {
  const inRange = records.filter((m) => Date.parse(m.timestamp) >= from.getTime() && Date.parse(m.timestamp) <= to.getTime())
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const samples = inRange.filter(valid).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const covers = (since: number, candidates = samples) => {
    const selected = candidates.filter((m) => Date.parse(m.timestamp) >= since);
    return selected.length >= 2 && Date.parse(selected[0].timestamp) - since <= maxGapMs &&
      to.getTime() - Date.parse(selected.at(-1)!.timestamp) <= maxGapMs &&
      selected.every((m, i) => i === 0 || Date.parse(m.timestamp) - Date.parse(selected[i - 1].timestamp) <= maxGapMs);
  };
  const stats = (key: 'temperature' | 'humidity' | 'pressure') => {
    const selected = inRange.filter((m) => validValue(m, key));
    if (!selected.length) return null;
    const values = selected.map((m) => m[key]);
    return { min: Math.min(...values), max: Math.max(...values), avg: round(values.reduce((a, b) => a + b, 0) / values.length),
      sampleCount: selected.length, firstObservedAt: selected[0].timestamp, lastObservedAt: selected.at(-1)!.timestamp,
      firstValue: values[0], lastValue: values.at(-1)!, coverageComplete: covers(from.getTime(), selected) };
  };
  const delta = (key: 'temperature' | 'pressure', hours: number) => {
    const target = to.getTime() - hours * 3600000;
    const selected = inRange.filter((m) => validValue(m, key));
    if (target < from.getTime() || !covers(target, selected)) return null;
    const nearest = selected.reduce((best, m) => Math.abs(Date.parse(m.timestamp) - target) < Math.abs(Date.parse(best.timestamp) - target) ? m : best);
    if (Math.abs(Date.parse(nearest.timestamp) - target) > maxGapMs) return null;
    return round(selected.at(-1)![key] - nearest[key]);
  };
  return { from: from.toISOString(), to: to.toISOString(), sampleCount: samples.length,
    invalidSampleCount: inRange.length - samples.length, coverageComplete: covers(from.getTime()),
    availableSampleCount: inRange.filter((m) => ['temperature', 'humidity', 'pressure'].some((key) => validValue(m, key as 'temperature' | 'humidity' | 'pressure'))).length,
    temperature: stats('temperature'), humidity: stats('humidity'), pressure: stats('pressure'),
    pressureDelta3hHpa: delta('pressure', 3), temperatureDelta1hC: delta('temperature', 1) };
}

export function describePressureTrend(features: WeatherFeatures): string {
  const delta = features.pressureDelta3hHpa;
  if (delta === null) return 'Chưa đủ chuỗi khí áp liên tục trong 3 giờ để xác định xu hướng';
  return `${classifyPressureTrend(delta, 0).labelVi}; thay đổi ${delta > 0 ? '+' : ''}${delta} hPa trong 3 giờ đã quan trắc`;
}
