import { z } from 'zod';

export const DeviceConfigUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  location: z.string().min(1).max(200).optional(),
  timezone: z.string().min(1).default('Asia/Ho_Chi_Minh').optional(),
  rainMmPerTip: z
    .number()
    .positive('Rain mm/tip calibration factor must be greater than 0')
    .max(5.0, 'Calibration factor must be reasonable (< 5 mm/tip)')
    .optional(),
  sensorInterval: z
    .number()
    .int()
    .min(1, 'Sensor interval must be at least 1 second')
    .max(3600, 'Sensor interval max 3600 seconds')
    .optional(),
  mqttInterval: z
    .number()
    .int()
    .min(5, 'MQTT interval must be at least 5 seconds')
    .max(3600, 'MQTT interval max 3600 seconds')
    .optional()
});

export const DeviceCreateSchema = z.object({
  deviceId: z.string().min(3).max(64),
  name: z.string().min(1).max(100),
  location: z.string().default('Trạm quan trắc'),
  timezone: z.string().default('Asia/Ho_Chi_Minh'),
  rainMmPerTip: z.number().positive().default(0.64),
  sensorInterval: z.number().int().min(1).default(10),
  mqttInterval: z.number().int().min(5).default(30)
});
