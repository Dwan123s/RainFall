import type { MeasurementRecord } from '../shared/types/telemetry';
import type { WeatherFeatures } from '../shared/ai-types';
import { classifyPressureTrend } from '../shared/utils/weather-calc';

const round = (n: number) => Math.round(n * 100) / 100;
const valid = (m: MeasurementRecord) => Number.isFinite(Date.parse(m.timestamp)) &&
  Number.isFinite(m.temperature) && m.temperature >= -40 && m.temperature <= 85 &&
  Number.isFinite(m.humidity) && m.humidity >= 0 && m.humidity <= 100 &&
  Number.isFinite(m.pressure) && m.pressure >= 300 && m.pressure <= 1100;

export function calculateWeatherFeatures(records: MeasurementRecord[], from: Date, to: Date, maxGapMs: number): WeatherFeatures {
  const inRange = records.filter((m) => Date.parse(m.timestamp) >= from.getTime() && Date.parse(m.timestamp) <= to.getTime());
  const samples = inRange.filter(valid).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const covers = (since: number) => {
    const selected = samples.filter((m) => Date.parse(m.timestamp) >= since);
    return selected.length >= 2 && Date.parse(selected[0].timestamp) - since <= maxGapMs &&
      to.getTime() - Date.parse(selected.at(-1)!.timestamp) <= maxGapMs &&
      selected.every((m, i) => i === 0 || Date.parse(m.timestamp) - Date.parse(selected[i - 1].timestamp) <= maxGapMs);
  };
  const stats = (key: 'temperature' | 'humidity' | 'pressure') => {
    if (!samples.length) return null;
    const values = samples.map((m) => m[key]);
    return { min: Math.min(...values), max: Math.max(...values), avg: round(values.reduce((a, b) => a + b, 0) / values.length) };
  };
  const delta = (key: 'temperature' | 'pressure', hours: number) => {
    const target = to.getTime() - hours * 3600000;
    if (target < from.getTime() || !covers(target)) return null;
    const nearest = samples.reduce((best, m) => Math.abs(Date.parse(m.timestamp) - target) < Math.abs(Date.parse(best.timestamp) - target) ? m : best);
    if (Math.abs(Date.parse(nearest.timestamp) - target) > maxGapMs) return null;
    return round(samples.at(-1)![key] - nearest[key]);
  };
  return { from: from.toISOString(), to: to.toISOString(), sampleCount: samples.length,
    invalidSampleCount: inRange.length - samples.length, coverageComplete: covers(from.getTime()),
    temperature: stats('temperature'), humidity: stats('humidity'), pressure: stats('pressure'),
    pressureDelta3hHpa: delta('pressure', 3), temperatureDelta1hC: delta('temperature', 1) };
}

export function describePressureTrend(features: WeatherFeatures): string {
  const delta = features.pressureDelta3hHpa;
  if (delta === null) return 'Chưa đủ chuỗi khí áp liên tục trong 3 giờ để xác định xu hướng';
  return `${classifyPressureTrend(delta, 0).labelVi}; thay đổi ${delta > 0 ? '+' : ''}${delta} hPa trong 3 giờ đã quan trắc`;
}
