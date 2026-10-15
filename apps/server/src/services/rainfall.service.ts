import {
  RainfallStatistics,
  calculateRainfall,
  calculateRainRate,
  getStartOfDayInTimezone,
  getStartOfMonthInTimezone
} from '@rainsense/shared';
import { dataStore } from '../db/store';
import { logger } from '../utils/logger';

export class RainfallService {
  /**
   * Calculate comprehensive rainfall statistics for a station
   */
  async getStatistics(deviceId: string): Promise<RainfallStatistics> {
    const device = await dataStore.getDevice(deviceId);
    const timezone = device?.timezone || 'Asia/Ho_Chi_Minh';
    const config = await dataStore.getConfig(deviceId);
    const calibrationFactor = config?.rainMmPerTip ?? 0.25;

    const allEvents = await dataStore.getRainEvents(deviceId);
    const now = new Date();
    const nowMs = now.getTime();

    // Time boundaries in station timezone
    const startOfToday = getStartOfDayInTimezone(now, timezone);
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 3600 * 1000);
    const rolling24hAgo = new Date(nowMs - 24 * 3600 * 1000);
    const rolling7dAgo = new Date(nowMs - 7 * 24 * 3600 * 1000);
    const startOfMonth = getStartOfMonthInTimezone(now, timezone);
    const fiveMinAgo = new Date(nowMs - 5 * 60 * 1000);
    const fifteenMinAgo = new Date(nowMs - 15 * 60 * 1000);

    let todayTips = 0;
    let yesterdayTips = 0;
    let rolling24hTips = 0;
    let last7dTips = 0;
    let monthTips = 0;
    let lifetimeTips = 0;
    let fiveMinTips = 0;
    let lastTipTimestamp: string | undefined = undefined;

    // Sort events chronologically
    const sorted = [...allEvents].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let maxRateMmH = 0;
    let timeOfMaxRate: string | undefined = undefined;

    for (let i = 0; i < sorted.length; i++) {
      const evt = sorted[i];
      const evtTime = new Date(evt.timestamp);
      const evtMs = evtTime.getTime();

      lifetimeTips += evt.tipCount;
      lastTipTimestamp = evt.timestamp;

      if (evtTime >= startOfToday) {
        todayTips += evt.tipCount;
      } else if (evtTime >= startOfYesterday && evtTime < startOfToday) {
        yesterdayTips += evt.tipCount;
      }

      if (evtTime >= rolling24hAgo) {
        rolling24hTips += evt.tipCount;
      }

      if (evtTime >= rolling7dAgo) {
        last7dTips += evt.tipCount;
      }

      if (evtTime >= startOfMonth) {
        monthTips += evt.tipCount;
      }

      if (evtTime >= fiveMinAgo) {
        fiveMinTips += evt.tipCount;
      }

      // Calculate sliding 5-min rate around this event to find max observed intensity
      let tipsInWindow = 0;
      for (let j = i; j >= 0; j--) {
        const pastEvt = sorted[j];
        if (evtMs - new Date(pastEvt.timestamp).getTime() <= 5 * 60 * 1000) {
          tipsInWindow += pastEvt.tipCount;
        } else {
          break;
        }
      }
      const windowMm = calculateRainfall(tipsInWindow, evt.calibrationFactor || calibrationFactor);
      const rate = calculateRainRate(windowMm, 5);
      if (rate > maxRateMmH) {
        maxRateMmH = rate;
        timeOfMaxRate = evt.timestamp;
      }
    }

    // Current 5-minute intensity
    const fiveMinMm = calculateRainfall(fiveMinTips, calibrationFactor);
    const currentRateMmH = calculateRainRate(fiveMinMm, 5);

    // Active rain event detection (any tips in past 15 min)
    let currentRainEvent: RainfallStatistics['currentRainEvent'] = undefined;
    if (sorted.length > 0) {
      const recentTips = sorted.filter((e) => new Date(e.timestamp) >= fifteenMinAgo);
      if (recentTips.length > 0) {
        // Event is currently active
        // Trace back contiguous tips separated by < 20 minutes
        let eventStartIndex = sorted.length - 1;
        for (let k = sorted.length - 1; k > 0; k--) {
          const diffMs =
            new Date(sorted[k].timestamp).getTime() - new Date(sorted[k - 1].timestamp).getTime();
          if (diffMs > 20 * 60 * 1000) {
            eventStartIndex = k;
            break;
          }
          if (k === 1) eventStartIndex = 0;
        }

        const eventEvents = sorted.slice(eventStartIndex);
        const eventTips = eventEvents.reduce((acc, cur) => acc + cur.tipCount, 0);
        const eventMm = calculateRainfall(eventTips, calibrationFactor);
        const startEvtTime = new Date(eventEvents[0].timestamp).getTime();
        const durationMinutes = Math.max(1, Math.round((nowMs - startEvtTime) / 60000));

        currentRainEvent = {
          startedAt: eventEvents[0].timestamp,
          totalMm: eventMm,
          durationMinutes,
          active: true
        };
      }
    }

    return {
      todayMm: calculateRainfall(todayTips, calibrationFactor),
      yesterdayMm: calculateRainfall(yesterdayTips, calibrationFactor),
      rolling24hMm: calculateRainfall(rolling24hTips, calibrationFactor),
      last7DaysMm: calculateRainfall(last7dTips, calibrationFactor),
      currentMonthMm: calculateRainfall(monthTips, calibrationFactor),
      lifetimeMm: calculateRainfall(lifetimeTips, calibrationFactor),
      currentRateMmH,
      fiveMinAvgMmH: currentRateMmH,
      maxObservedRateMmH: Math.max(maxRateMmH, currentRateMmH),
      timeOfMaxRate: timeOfMaxRate || (currentRateMmH > 0 ? now.toISOString() : undefined),
      totalTipsToday: todayTips,
      lifetimeTips,
      calibrationFactor,
      lastTipTimestamp,
      currentRainEvent
    };
  }

  /**
   * Get hourly rainfall aggregation for charts (past 24 hours)
   */
  async getHourlyRainfall(deviceId: string, hours: number = 24) {
    const config = await dataStore.getConfig(deviceId);
    const calibrationFactor = config?.rainMmPerTip ?? 0.25;
    const now = new Date();
    const fromTime = new Date(now.getTime() - hours * 3600 * 1000);

    const events = await dataStore.getRainEvents(deviceId, fromTime.toISOString());

    // Create hourly buckets
    const buckets: Array<{ hour: string; timestamp: string; rainfallMm: number; tips: number }> = [];
    for (let h = hours - 1; h >= 0; h--) {
      const bucketStart = new Date(now.getTime() - h * 3600 * 1000);
      bucketStart.setMinutes(0, 0, 0);
      const bucketEnd = new Date(bucketStart.getTime() + 3600 * 1000);

      const hourLabel = `${bucketStart.getHours().toString().padStart(2, '0')}:00`;

      const inBucket = events.filter((e) => {
        const t = new Date(e.timestamp);
        return t >= bucketStart && t < bucketEnd;
      });

      const tips = inBucket.reduce((sum, e) => sum + e.tipCount, 0);
      const rainfallMm = calculateRainfall(tips, calibrationFactor);

      buckets.push({
        hour: hourLabel,
        timestamp: bucketStart.toISOString(),
        rainfallMm,
        tips
      });
    }

    return buckets;
  }

  /**
   * Get daily rainfall aggregation (past 7 or 30 days)
   */
  async getDailyRainfall(deviceId: string, days: number = 7) {
    const config = await dataStore.getConfig(deviceId);
    const calibrationFactor = config?.rainMmPerTip ?? 0.25;
    const now = new Date();
    const fromTime = new Date(now.getTime() - days * 24 * 3600 * 1000);

    const events = await dataStore.getRainEvents(deviceId, fromTime.toISOString());

    const buckets: Array<{ date: string; dayLabel: string; rainfallMm: number; tips: number }> = [];
    for (let d = days - 1; d >= 0; d--) {
      const dayDate = new Date(now.getTime() - d * 24 * 3600 * 1000);
      dayDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(dayDate.getTime() + 24 * 3600 * 1000);

      const dateStr = `${dayDate.getFullYear()}-${(dayDate.getMonth() + 1).toString().padStart(2, '0')}-${dayDate.getDate().toString().padStart(2, '0')}`;
      const dayLabel = `${dayDate.getDate().toString().padStart(2, '0')}/${(dayDate.getMonth() + 1).toString().padStart(2, '0')}`;

      const inBucket = events.filter((e) => {
        const t = new Date(e.timestamp);
        return t >= dayDate && t < nextDay;
      });

      const tips = inBucket.reduce((sum, e) => sum + e.tipCount, 0);
      const rainfallMm = calculateRainfall(tips, calibrationFactor);

      buckets.push({
        date: dateStr,
        dayLabel,
        rainfallMm,
        tips
      });
    }

    return buckets;
  }
}

export const rainfallService = new RainfallService();
