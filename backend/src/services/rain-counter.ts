import type { MeasurementRecord } from '../shared/types/telemetry';
type Counter = { tips: number; timestamp: string; uptime?: number; reset?: number; bootId?: string };
const counters = new Map<string, Counter>();
const pending = new Map<string, Promise<unknown>>();
export async function withRainLock<T>(deviceId: string, work: () => Promise<T>): Promise<T> {
  const prior = pending.get(deviceId) ?? Promise.resolve();
  const current = prior.catch(() => undefined).then(work);
  pending.set(deviceId, current);
  try { return await current; } finally { if (pending.get(deviceId) === current) pending.delete(deviceId); }
}

/** Counter snapshots only establish an interval, not exact timestamps for every tip. */
export function advanceRainCounter(deviceId: string, next: Counter, persisted?: MeasurementRecord | null, directTipCount?: number) {
  let previous = counters.get(deviceId);
  if (!previous && persisted && Number.isSafeInteger(persisted.totalRainTips)) previous = { tips: persisted.totalRainTips!, timestamp: persisted.timestamp, uptime: persisted.uptime };
  if (!Number.isSafeInteger(next.tips) || next.tips < 0 || !Number.isFinite(Date.parse(next.timestamp)) || Date.parse(next.timestamp) > Date.now() + 60000) return null;
  if (previous && Date.parse(next.timestamp) < Date.parse(previous.timestamp)) return null;
  const reset = previous && (next.tips < previous.tips || next.reset !== undefined && previous.reset !== undefined && next.reset !== previous.reset || next.bootId && previous.bootId && next.bootId !== previous.bootId || next.uptime !== undefined && previous.uptime !== undefined && next.uptime < previous.uptime);
  counters.set(deviceId, next);
  if (reset) return null; // New baseline; never erase older event history.
  const increment = previous ? next.tips - previous.tips : directTipCount ?? 0;
  if (increment <= 0) return null;
  // Direct single-tip messages contain an actual device tip time. Counter deltas remain batched.
  return { increment, intervalFrom: directTipCount === 1 && increment === 1 ? undefined : previous?.timestamp,
    timingQuality: directTipCount === 1 && increment === 1 ? 'device_tip' as const : 'telemetry_interval' as const };
}
