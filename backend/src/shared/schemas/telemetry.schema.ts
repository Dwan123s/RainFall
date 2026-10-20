import { z } from 'zod';

export const TelemetryPayloadSchema = z.object({
  messageId: z.string().min(1, 'messageId is required'),
  deviceId: z.string().min(1, 'deviceId is required'),
  bootId: z.string().min(1, 'bootId is required'),
  sequenceNumber: z.number().int().nonnegative(),
  timestamp: z.string().datetime({ message: 'timestamp must be a valid ISO 8601 string' }),
  temperature: z.number().min(-40).max(85, 'Temperature must be between -40 and 85 °C'),
  humidity: z.number().min(0).max(100, 'Humidity must be between 0 and 100 %'),
  pressure: z.number().min(300).max(1200, 'Pressure must be between 300 and 1200 hPa'),
  totalRainTips: z.number().int().nonnegative(),
  rainRate: z.number().min(0, 'Rain rate cannot be negative'),
  wifiRssi: z.number().min(-120).max(0, 'WiFi RSSI should be between -120 and 0 dBm'),
  uptime: z.number().int().nonnegative(),
  firmwareVersion: z.string().default('1.0.0'),
  batteryVoltage: z.number().optional()
});

export const RainEventPayloadSchema = z.object({
  messageId: z.string().min(1, 'messageId is required'),
  deviceId: z.string().min(1, 'deviceId is required'),
  bootId: z.string().min(1, 'bootId is required'),
  sequenceNumber: z.number().int().nonnegative(),
  timestamp: z.string().datetime({ message: 'timestamp must be ISO 8601' }),
  tipCount: z.number().int().positive('tipCount must be >= 1').default(1),
  cumulativeTips: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative().optional(),
  instantIntensityMmH: z.number().nonnegative().optional()
});

export const DeviceStatusPayloadSchema = z.object({
  deviceId: z.string().min(1),
  status: z.enum(['online', 'offline', 'reconnecting']),
  timestamp: z.string().datetime(),
  uptime: z.number().optional(),
  wifiRssi: z.number().optional(),
  reason: z.string().optional(),
  firmwareVersion: z.string().optional()
});

export const DeviceCommandAckSchema = z.object({
  commandId: z.string().min(1),
  deviceId: z.string().min(1),
  status: z.enum(['SUCCESS', 'FAILED']),
  message: z.string().optional(),
  timestamp: z.string().datetime()
});
