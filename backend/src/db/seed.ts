import bcrypt from 'bcryptjs';
import { dataStore } from './store';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export async function seedInitialData() {
  logger.info('Initializing production configuration for ESP32-S3 hardware...');

  // 1. Purge any stale/mock historical telemetry, rain events, and sample alerts
  await dataStore.clearTelemetryData();

  // 2. Provision Admin User
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, salt);
  await dataStore.createUser({
    email: env.ADMIN_EMAIL,
    passwordHash,
    role: 'ADMIN'
  });
  logger.info({ email: env.ADMIN_EMAIL }, 'Default Admin User provisioned');

  // 3. Configure Primary ESP32-S3 Station (Clean hardware state)
  const deviceId = env.DEFAULT_STATION_ID;
  await dataStore.upsertDevice({
    deviceId,
    name: 'Trạm Quan Trắc ESP32-S3 — BME280 & A3144',
    location: 'Trạm thực địa ESP32-S3',
    timezone: env.DEFAULT_TIMEZONE,
    firmwareVersion: '1.2.0-prod',
    rainMmPerTip: env.DEFAULT_CALIBRATION_MM_PER_TIP
  });

  // Ensure device starts in realistic offline waiting state (no fake online status)
  await dataStore.updateDeviceStatus(deviceId, false, '', undefined, undefined);

  // 4. Seed Standard Alert Threshold Rules (Operational Safety Limits)
  const existingRules = await dataStore.getAlertRules(deviceId);
  if (existingRules.length === 0) {
    await dataStore.createAlertRule({
      deviceId,
      alertType: 'HEAVY_RAIN',
      threshold: 15.0, // mm/h
      comparison: 'GREATER_THAN',
      enabled: true,
      severity: 'WARNING',
      description: 'Cảnh báo mưa lớn vượt ngưỡng 15.0 mm/h'
    });
    await dataStore.createAlertRule({
      deviceId,
      alertType: 'HIGH_TEMPERATURE',
      threshold: 37.0, // °C
      comparison: 'GREATER_THAN',
      enabled: true,
      severity: 'WARNING',
      description: 'Nhiệt độ môi trường cao vượt 37°C'
    });
    await dataStore.createAlertRule({
      deviceId,
      alertType: 'LOW_HUMIDITY',
      threshold: 30.0, // %
      comparison: 'LESS_THAN',
      enabled: true,
      severity: 'INFO',
      description: 'Độ ẩm không khí giảm thấp dưới 30%'
    });
    await dataStore.createAlertRule({
      deviceId,
      alertType: 'DEVICE_OFFLINE',
      threshold: 120, // seconds
      comparison: 'GREATER_THAN',
      enabled: true,
      severity: 'CRITICAL',
      description: 'Mất tín hiệu kết nối trạm quá 2 phút'
    });
  }

  logger.info({ deviceId }, 'ESP32-S3 station initialized with clean database state (Zero fake data).');
}
