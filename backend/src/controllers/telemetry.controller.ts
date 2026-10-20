import { Request, Response } from 'express';
import { dataStore } from '../db/store';
import { measurementService } from '../services/measurement.service';
import { rainfallService } from '../services/rainfall.service';
import { getMqttStatus } from '../mqtt/client';
import { env } from '../config/env';

export const telemetryController = {
  async getLatest(req: Request, res: Response) {
    const { id } = req.params;
    const latest = await dataStore.getLatestMeasurement(id);
    return res.json({ success: true, data: latest });
  },

  async getSeries(req: Request, res: Response) {
    const { id } = req.params;
    const range = (req.query.range as any) || '24h';
    const from = req.query.from as string;
    const to = req.query.to as string;

    const series = await measurementService.getTelemetrySeries(id, range, from, to);
    return res.json({ success: true, data: series });
  },

  async getEnvironmentalSummary(req: Request, res: Response) {
    const { id } = req.params;
    const summary = await measurementService.getEnvironmentalSummary(id);
    return res.json({ success: true, data: summary });
  },

  async getRainfallStats(req: Request, res: Response) {
    const { id } = req.params;
    const stats = await rainfallService.getStatistics(id);
    return res.json({ success: true, data: stats });
  },

  async getHourlyRain(req: Request, res: Response) {
    const { id } = req.params;
    const hours = req.query.hours ? parseInt(req.query.hours as string, 10) : 24;
    const data = await rainfallService.getHourlyRainfall(id, hours);
    return res.json({ success: true, data });
  },

  async getDailyRain(req: Request, res: Response) {
    const { id } = req.params;
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
    const data = await rainfallService.getDailyRainfall(id, days);
    return res.json({ success: true, data });
  },

  async getDashboardSummary(req: Request, res: Response) {
    const deviceId = (req.query.deviceId as string) || env.DEFAULT_STATION_ID;

    let device = await dataStore.getDevice(deviceId);
    if (!device) {
      const all = await dataStore.getAllDevices();
      device = all[0] || null;
    }

    if (!device) {
      return res.status(404).json({ success: false, error: 'Không có trạm quan trắc nào trong hệ thống' });
    }

    const latest = await dataStore.getLatestMeasurement(device.deviceId);
    const rainfall = await rainfallService.getStatistics(device.deviceId);
    const recentAlerts = await dataStore.getAlerts({ deviceId: device.deviceId, limit: 5 });
    const unreadAlerts = await dataStore.getAlerts({ deviceId: device.deviceId, isRead: false });

    // Calculate stale status
    const hasReceivedData = !!latest;
    const nowMs = Date.now();
    const lastSeenMs = latest ? new Date(latest.timestamp).getTime() : 0;
    const lastSeenSecondsAgo = latest ? Math.max(0, Math.round((nowMs - lastSeenMs) / 1000)) : null;
    const isStale = latest ? (lastSeenSecondsAgo !== null && lastSeenSecondsAgo > 90) : false;

    const mqttStatus = getMqttStatus();

    const systemHealth = {
      bme280Status: latest && !isStale ? ('OK' as const) : hasReceivedData ? ('STALE' as const) : ('WAITING' as const),
      rainGaugeStatus: 'OK' as const,
      mqttStatus,
      backendStatus: 'HEALTHY' as const,
      lastSeenSecondsAgo: lastSeenSecondsAgo ?? 0,
      hasReceivedData,
      isStale
    };

    return res.json({
      success: true,
      data: {
        device,
        latestMeasurement: latest,
        rainfall,
        systemHealth,
        recentAlerts,
        activeAlertCount: unreadAlerts.length,
        mode: env.DEMO_MODE ? 'DEMO' : 'LIVE'
      }
    });
  }
};
