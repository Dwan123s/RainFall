import { MeasurementRecord, classifyPressureTrend, calculateDewPoint } from '../shared';
import { dataStore } from '../db/store';
import { calculateWeatherFeatures } from './ai-weather-features';

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

    const measurements24h = await dataStore.getMeasurements(deviceId, {
      from: past24h.toISOString(),
      to: now.toISOString(),
      limit: 20000
    });

    const latest = await dataStore.getLatestMeasurement(deviceId);

    if (measurements24h.length === 0 || !latest) {
      return {
        temperature: { current: null, min: null, max: null, avg: null, diff1h: null, trend: 'UNKNOWN' },
        humidity: { current: null, min: null, max: null, avg: null },
        pressure: {
          current: null,
          min: null,
          max: null,
          avg: null,
          trend: { category: 'UNKNOWN', labelVi: 'Chưa có dữ liệu', deltaHpa: null }
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

    const config = await dataStore.getConfig(deviceId);
    const features = calculateWeatherFeatures(measurements24h, past24h, now, Math.max(120000, (config?.mqttInterval ?? 30) * 3000));
    const pressureTrend = classifyPressureTrend(features.pressureDelta3hHpa ?? NaN, 0);
    const tempDiff = features.temperatureDelta1hC;

    return {
      temperature: {
        current: latest.temperature,
        min: minTemp,
        max: maxTemp,
        avg: avgTemp,
        diff1h: tempDiff,
        trend: tempDiff === null ? 'UNKNOWN' : tempDiff > 0.3 ? 'RISING' : tempDiff < -0.3 ? 'FALLING' : 'STABLE'
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
