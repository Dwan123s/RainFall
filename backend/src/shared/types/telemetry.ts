/**
 * Telemetry data transmitted by ESP32-S3 over MQTT
 * Topic: weather/{deviceId}/telemetry
 */
export interface TelemetryPayload {
  messageId: string;
  deviceId: string;
  bootId: string;
  sequenceNumber: number;
  timestamp: string; // ISO 8601 UTC e.g. "2026-10-12T08:50:00.000Z"
  temperature: number; // °C (from BME280)
  humidity: number; // % RH (from BME280)
  pressure: number; // hPa (from BME280)
  totalRainTips: number; // Cumulative bucket tips
  rainRate: number; // mm/h (calculated rate over recent window)
  wifiRssi: number; // dBm (e.g. -65)
  uptime: number; // seconds since ESP32 boot
  firmwareVersion: string; // e.g. "1.0.0"
  batteryVoltage?: number; // V (optional)
}

/**
 * Persisted Measurement in database
 */
export interface MeasurementRecord {
  id: string;
  deviceId: string;
  messageId: string;
  timestamp: string;
  temperature: number;
  humidity: number;
  pressure: number;
  wifiRssi: number;
  uptime: number;
  dewPoint?: number;
  rainRate?: number;
  totalRainTips?: number;
  createdAt: string;
}

/**
 * Device Status (Heartbeat or LWT)
 * Topic: weather/{deviceId}/status
 */
export interface DeviceStatusPayload {
  deviceId: string;
  status: 'online' | 'offline' | 'reconnecting';
  timestamp: string;
  uptime?: number;
  wifiRssi?: number;
  reason?: string;
  firmwareVersion?: string;
}
