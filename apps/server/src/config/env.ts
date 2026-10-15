import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from root or local directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const EnvSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/rainsense?sslmode=disable'),
  MQTT_BROKER_URL: z.string().default('tls://mock-broker.hivemq.cloud:8883'),
  MQTT_USERNAME: z.string().optional().default(''),
  MQTT_PASSWORD: z.string().optional().default(''),
  MQTT_CLIENT_ID: z.string().default('rainsense-backend-server'),
  MQTT_TOPIC_PREFIX: z.string().default('weather'),
  JWT_SECRET: z.string().min(16).default('rainsense_super_secure_jwt_secret_key_at_least_32_characters'),
  ADMIN_EMAIL: z.string().email().default('admin@rainsense.io'),
  ADMIN_PASSWORD: z.string().min(6).default('Admin@123456'),
  DEMO_MODE: z.string().default('false').transform((val) => val === 'true' || val === '1'),
  CORS_ORIGIN: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  DEFAULT_STATION_ID: z.string().default('RS-ESP32S3-01'),
  DEFAULT_CALIBRATION_MM_PER_TIP: z.string().default('0.25').transform((val) => parseFloat(val)),
  DEFAULT_TIMEZONE: z.string().default('Asia/Ho_Chi_Minh')
});

export const env = EnvSchema.parse(process.env);
