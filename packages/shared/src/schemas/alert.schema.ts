import { z } from 'zod';

export const AlertRuleCreateSchema = z.object({
  deviceId: z.string().min(1),
  alertType: z.enum([
    'HEAVY_RAIN',
    'HIGH_TEMPERATURE',
    'LOW_TEMPERATURE',
    'HIGH_HUMIDITY',
    'LOW_HUMIDITY',
    'DEVICE_OFFLINE',
    'MISSING_TELEMETRY',
    'SENSOR_ERROR',
    'MQTT_FAILURE'
  ]),
  threshold: z.number(),
  comparison: z.enum(['GREATER_THAN', 'LESS_THAN']),
  enabled: z.boolean().default(true),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  description: z.string().optional()
});

export const AlertRuleUpdateSchema = AlertRuleCreateSchema.partial();
