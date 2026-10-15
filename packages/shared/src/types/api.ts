import { MeasurementRecord, TelemetryPayload } from './telemetry';
import { RainEventRecord, RainfallStatistics } from './rain';
import { DeviceRecord, DeviceCommandRecord } from './device';
import { AlertRecord } from './alert';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface DashboardSummaryData {
  device: DeviceRecord;
  latestMeasurement?: MeasurementRecord;
  rainfall: RainfallStatistics;
  systemHealth: {
    bme280Status: 'OK' | 'ERROR' | 'STALE';
    rainGaugeStatus: 'OK' | 'IDLE' | 'ERROR';
    mqttStatus: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
    backendStatus: 'HEALTHY' | 'DEGRADED';
    lastSeenSecondsAgo: number;
    isStale: boolean;
  };
  recentAlerts: AlertRecord[];
  activeAlertCount: number;
  mode: 'LIVE' | 'DEMO';
}

export interface SocketEventsMap {
  'telemetry:update': (data: { deviceId: string; measurement: MeasurementRecord; latest: TelemetryPayload }) => void;
  'rain:update': (data: { deviceId: string; rainEvent: RainEventRecord; statistics: RainfallStatistics }) => void;
  'device:status': (data: { deviceId: string; isOnline: boolean; lastSeen: string; wifiRssi?: number }) => void;
  'alert:new': (data: AlertRecord) => void;
  'command:status': (data: DeviceCommandRecord) => void;
  'mode:change': (data: { mode: 'LIVE' | 'DEMO' }) => void;
}
