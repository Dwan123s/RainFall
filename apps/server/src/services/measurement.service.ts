import { MeasurementRecord, classifyPressureTrend, calculateDewPoint } from '@rainsense/shared';
import { dataStore } from '../db/store';

export class MeasurementService {
  /**
   * Get filtered measurements with auto-downsampling for large date ranges
   */
  async getTelemetrySeries(
    deviceId: string,
    range: '1h' | '6h' | '24h' | '7d' | '30d' | 'custom',
    customFrom?: string,
    customTo?: string
  ): Promise<MeasurementRecord[]> {
    const now = new Date();
    let from: Date;
    let to: Date = customTo ? new Date(customTo) : now;

    switch (range) {
      case '1h':
        from = new Date(now.getTime() - 1 * 3600 * 1000);
        break;
      case '6h':
        from = new Date(now.getTime() - 6 * 3600 * 1000);
        break;
      case '24h':
        from = new Date(now.getTime() - 24 * 3600 * 1000);
        break;
      case '7d':
        from = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        break;
      case '30d':
        from = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
        break;
      case 'custom':
        from = customFrom ? new Date(customFrom) : new Date(now.getTime() - 24 * 3600 * 1000);
        break;
      default:
        from = new Date(now.getTime() - 24 * 3600 * 1000);
    }

    const records = await dataStore.getMeasurements(deviceId, {
      from: from.toISOString(),
      to: to.toISOString(),
      limit: 5000
    });

    // If records count > 300, downsample evenly to keep chart snappy
    if (records.length > 300) {
      const step = Math.ceil(records.length / 300);
      const sampled: MeasurementRecord[] = [];
      for (let i = 0; i < records.length; i += step) {
        sampled.push(records[i]);
      }
      // Ensure the latest point is included
      if (sampled[sampled.length - 1] !== records[records.length - 1]) {
        sampled.push(records[records.length - 1]);
      }
      return sampled;
    }

    return records;
  }

  /**
   * Get aggregated environmental statistics (min, max, avg, trend)
   */
  async getEnvironmentalSummary(deviceId: string) {
    const now = new Date();
    const past24h = new Date(now.getTime() - 24 * 3600 * 1000);
    const past3h = new Date(now.getTime() - 3 * 3600 * 1000);

    const measurements24h = await dataStore.getMeasurements(deviceId, {
      from: past24h.toISOString(),
      limit: 1000
    });

    const latest = await dataStore.getLatestMeasurement(deviceId);

    if (measurements24h.length === 0 || !latest) {
      return {
        temperature: { current: null, min: null, max: null, avg: null, diff1h: 0, trend: 'STABLE' },
        humidity: { current: null, min: null, max: null, avg: null },
        pressure: {
          current: null,
          min: null,
          max: null,
          avg: null,
          trend: { category: 'STABLE', labelVi: 'Chưa có dữ liệu', rateHPaPer3h: 0 }
        },
        dewPoint: { current: null }
      };
    }

    const temps = measurements24h.map((m) => m.temperature);
    const humids = measurements24h.map((m) => m.humidity);
    const pressures = measurements24h.map((m) => m.pressure);

    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const avgTemp = Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10;

    const minHumid = Math.min(...humids);
    const maxHumid = Math.max(...humids);
    const avgHumid = Math.round((humids.reduce((a, b) => a + b, 0) / humids.length) * 10) / 10;

    const minPress = Math.min(...pressures);
    const maxPress = Math.max(...pressures);
    const avgPress = Math.round((pressures.reduce((a, b) => a + b, 0) / pressures.length) * 10) / 10;

    // Find 3 hours ago measurement for barometric trend
    const press3hAgoRecord = measurements24h.find(
      (m) => new Date(m.timestamp) <= past3h
    );
    const pressureTrend = classifyPressureTrend(latest.pressure, press3hAgoRecord?.pressure);

    // Temp trend comparing with 1 hour ago
    const oneHourAgo = new Date(now.getTime() - 3600 * 1000);
    const temp1hAgo = measurements24h.find((m) => new Date(m.timestamp) <= oneHourAgo)?.temperature;
    const tempDiff = temp1hAgo !== undefined ? Math.round((latest.temperature - temp1hAgo) * 10) / 10 : 0;

    return {
      temperature: {
        current: latest.temperature,
        min: minTemp,
        max: maxTemp,
        avg: avgTemp,
        diff1h: tempDiff,
        trend: tempDiff > 0.3 ? 'RISING' : tempDiff < -0.3 ? 'FALLING' : 'STABLE'
      },
      humidity: {
        current: latest.humidity,
        min: minHumid,
        max: maxHumid,
        avg: avgHumid
      },
      pressure: {
        current: latest.pressure,
        min: minPress,
        max: maxPress,
        avg: avgPress,
        trend: pressureTrend
      },
      dewPoint: {
        current: latest.dewPoint ?? calculateDewPoint(latest.temperature, latest.humidity)
      }
    };
  }
}

export const measurementService = new MeasurementService();
