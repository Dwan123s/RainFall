import { getStartOfDayInTimezone, getStartOfMonthInTimezone } from '../shared';
import { dataStore } from '../db/store';
import type { RainfallStatistics, RainEventRecord } from '../shared/types/rain';
import { readRainLedger, sumRain, sumTips } from './rain-ledger';

/** Dashboard and AI sum stored event amounts, never the hardware lifetime counter. */
export class RainfallService {
  async getStatistics(deviceId: string, now = new Date()): Promise<RainfallStatistics> {
    const [device, config, ledger] = await Promise.all([dataStore.getDevice(deviceId), dataStore.getConfig(deviceId), readRainLedger(deviceId, undefined, now.toISOString())]);
    const timezone = device?.timezone || 'Asia/Ho_Chi_Minh';
    const calibrationFactor = config?.rainMmPerTip ?? 0.64;
    const today = getStartOfDayInTimezone(now, timezone).getTime();
    const at = now.getTime();
    const sorted = ledger.filter((e) => e.dataKind !== 'test').sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const inWindow = (from: number, to = at, source = sorted) => source.filter((e) => Date.parse(e.timestamp) >= from && Date.parse(e.timestamp) <= to);
    const todayEvents = inWindow(today);
    const tests = inWindow(today, at, ledger.filter((e) => e.dataKind === 'test'));
    const rate = (events: RainEventRecord[]) => Math.round(sumRain(events) * 12 * 10) / 10;
    const currentRateMmH = rate(inWindow(at - 300000));
    let maxObservedRateMmH = 0;
    let timeOfMaxRate: string | undefined;
    let left = 0;
    let windowMm = 0;
    for (let right = 0; right < sorted.length; right++) {
      windowMm += sorted[right].rainfallMm;
      while (Date.parse(sorted[right].timestamp) - Date.parse(sorted[left].timestamp) > 300000) windowMm -= sorted[left++].rainfallMm;
      const candidate = Math.round(windowMm * 12 * 10) / 10;
      if (candidate > maxObservedRateMmH) { maxObservedRateMmH = candidate; timeOfMaxRate = sorted[right].timestamp; }
    }
    let currentRainEvent: RainfallStatistics['currentRainEvent'];
    if (sorted.length && Date.parse(sorted.at(-1)!.timestamp) >= at - 900000) {
      let first = sorted.length - 1;
      while (first > 0 && Date.parse(sorted[first].timestamp) - Date.parse(sorted[first - 1].timestamp) <= 1200000) first--;
      currentRainEvent = { startedAt: sorted[first].timestamp, totalMm: sumRain(sorted.slice(first)), durationMinutes: Math.max(1, Math.round((at - Date.parse(sorted[first].timestamp)) / 60000)), active: true };
    }
    return { todayMm: sumRain(todayEvents), totalTipsToday: sumTips(todayEvents),
      yesterdayMm: sumRain(sorted.filter((e) => Date.parse(e.timestamp) >= today - 86400000 && Date.parse(e.timestamp) < today)),
      rolling24hMm: sumRain(inWindow(at - 86400000)), last7DaysMm: sumRain(inWindow(at - 7 * 86400000)),
      currentMonthMm: sumRain(inWindow(getStartOfMonthInTimezone(now, timezone).getTime())),
      lifetimeMm: sumRain(sorted), lifetimeTips: sumTips(sorted), calibrationFactor,
      currentRateMmH, fiveMinAvgMmH: currentRateMmH, maxObservedRateMmH, timeOfMaxRate,
      lastTipTimestamp: sorted.at(-1)?.timestamp, currentRainEvent,
      testTodayMm: sumRain(tests), testTipsToday: sumTips(tests),
      recordedTodayMm: sumRain([...todayEvents, ...tests]), recordedTipsToday: sumTips([...todayEvents, ...tests]),
      classification: 'Đã loại nước thử được đánh dấu; phần còn lại chưa xác minh là mưa tự nhiên.' };
  }

  async getHourlyRainfall(deviceId: string, hours = 24, now = new Date()) {
    hours = Number.isFinite(hours) ? Math.min(168, Math.max(1, Math.floor(hours))) : 24;
    const device = await dataStore.getDevice(deviceId);
    const timezone = device?.timezone || 'Asia/Ho_Chi_Minh';
    const hourStart = Math.floor(now.getTime() / 3600000) * 3600000;
    const from = hourStart - (hours - 1) * 3600000;
    const events = (await readRainLedger(deviceId, new Date(from).toISOString(), now.toISOString())).filter((e) => e.dataKind !== 'test');
    return Array.from({ length: hours }, (_, i) => {
      const start = from + i * 3600000;
      const selected = events.filter((e) => Date.parse(e.timestamp) >= start && Date.parse(e.timestamp) < start + 3600000);
      return { hour: new Date(start).toLocaleTimeString('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }), timestamp: new Date(start).toISOString(), rainfallMm: sumRain(selected), tips: sumTips(selected) };
    });
  }

  async getDailyRainfall(deviceId: string, days = 7, now = new Date()) {
    days = Number.isFinite(days) ? Math.min(31, Math.max(1, Math.floor(days))) : 7;
    const device = await dataStore.getDevice(deviceId);
    const timezone = device?.timezone || 'Asia/Ho_Chi_Minh';
    const from = getStartOfDayInTimezone(now, timezone).getTime() - (days - 1) * 86400000;
    const events = (await readRainLedger(deviceId, new Date(from).toISOString(), now.toISOString())).filter((e) => e.dataKind !== 'test');
    return Array.from({ length: days }, (_, i) => {
      const start = from + i * 86400000;
      const selected = events.filter((e) => Date.parse(e.timestamp) >= start && Date.parse(e.timestamp) < start + 86400000);
      return { date: new Date(start).toLocaleDateString('en-CA', { timeZone: timezone }), dayLabel: new Date(start).toLocaleDateString('en-GB', { timeZone: timezone, day: '2-digit', month: '2-digit' }), rainfallMm: sumRain(selected), tips: sumTips(selected) };
    });
  }
}
export const rainfallService = new RainfallService();
