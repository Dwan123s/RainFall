import { dataStore } from '../db/store';
import type { RainEventRecord, RainTestPeriod } from '../shared/types/rain';

export const sumRain = (events: RainEventRecord[]) => Math.round(events.reduce((s, e) => s + e.rainfallMm, 0) * 100) / 100;
export const sumTips = (events: RainEventRecord[]) => events.reduce((s, e) => s + e.tipCount, 0);
export function classifyRainEvents(events: RainEventRecord[], periods: RainTestPeriod[]): RainEventRecord[] {
  return events.filter((e) => Number.isFinite(Date.parse(e.timestamp)) && e.tipCount > 0 && Number.isSafeInteger(e.tipCount) && Number.isFinite(e.rainfallMm) && e.rainfallMm >= 0)
    .map((event) => {
      // For a batched counter increment, quarantine the whole batch if its possible interval overlaps a test.
      const end = Date.parse(event.timestamp);
      const start = Date.parse(event.intervalFrom ?? event.timestamp);
      const period = periods.find((p) => p.deviceId === event.deviceId && end >= Date.parse(p.from) && start < Date.parse(p.to));
      return { ...event, dataKind: period || event.dataKind === 'test' ? 'test' as const : 'unverified' as const, testNote: period?.note ?? event.testNote };
    });
}
export async function readRainLedger(deviceId: string, from?: string, to = new Date().toISOString()) {
  const [events, periods] = await Promise.all([dataStore.getRainEvents(deviceId, from, to), dataStore.getRainTestPeriods(deviceId)]);
  return classifyRainEvents(events, periods);
}
