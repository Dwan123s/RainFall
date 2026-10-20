import { dataStore } from '../../db/store';
import { alertService } from '../../services/alert.service';
import { rainfallService } from '../../services/rainfall.service';
import { emitTelemetryUpdate, emitNewAlert, emitDeviceStatus, emitRainUpdate } from '../../socket/io';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

// Track last known tip count per device to detect bucket tip increments
const lastKnownTips = new Map<string, number>();

export async function handleTelemetryMessage(topic: string, rawPayload: Buffer | string) {
  try {
    const rawStr = rawPayload.toString();
    const json = JSON.parse(rawStr);
    const parts = topic.split('/');
    const stationIdFromTopic = parts[1] || env.DEFAULT_STATION_ID;

    // Detect field mapping (Support standard schema and IOT_MQTT_TLS.ino)
    const deviceId = (json.deviceId || json.device_id || stationIdFromTopic).trim();

    // Temperature (IOT_MQTT_TLS.ino sends temperature_c)
    let temperature: number = 0;
    if (typeof json.temperature === 'number') {
      temperature = json.temperature;
    } else if (typeof json.temperature_c === 'number') {
      temperature = json.temperature_c;
    }

    // Humidity (IOT_MQTT_TLS.ino sends humidity_pct)
    let humidity: number = 0;
    if (typeof json.humidity === 'number') {
      humidity = json.humidity;
    } else if (typeof json.humidity_pct === 'number') {
      humidity = json.humidity_pct;
    }

    // Pressure (IOT_MQTT_TLS.ino sends pressure_hpa)
    let pressure: number = 1013.25;
    if (typeof json.pressure === 'number') {
      pressure = json.pressure;
    } else if (typeof json.pressure_hpa === 'number') {
      pressure = json.pressure_hpa;
    }

    // Rain tips and rainfall (firmware default calibration: 0.64mm per tip)
    const totalRainTips: number = json.totalRainTips ?? json.tip_count ?? 0;
    const rainRate: number = json.rainRate ?? 0;

    // RSSI & Uptime
    const wifiRssi: number = json.wifiRssi ?? json.wifi_rssi_dbm ?? -60;
    let uptime: number = 0;
    if (typeof json.uptime === 'number') {
      uptime = json.uptime;
    } else if (typeof json.uptime_ms === 'number') {
      uptime = Math.round(json.uptime_ms / 1000);
    }

    // Timestamp
    let timestamp = new Date().toISOString();
    if (typeof json.timestamp === 'string' && json.timestamp.length > 5) {
      timestamp = json.timestamp;
    } else if (typeof json.published_at_unix === 'number' && json.published_at_unix > 1700000000) {
      timestamp = new Date(json.published_at_unix * 1000).toISOString();
    }

    // Deduplication key
    const messageId =
      json.messageId ||
      `${deviceId}-${json.published_at_unix || Date.now()}-${totalRainTips}-${uptime}`;

    if (dataStore.isMessageProcessed(messageId)) {
      logger.debug({ messageId }, 'Duplicate telemetry message ignored');
      return;
    }

    // Auto-create/ensure device in database
    await dataStore.upsertDevice({
      deviceId,
      name: `Trạm ${stationIdFromTopic}`,
      location: 'Trạm khí tượng tự động',
      rainMmPerTip: 0.64
    });

    // Update Device status
    await dataStore.updateDeviceStatus(deviceId, true, timestamp, wifiRssi, uptime);
    emitDeviceStatus(deviceId, true, timestamp, wifiRssi);

    // Save measurement to database
    const saved = await dataStore.saveMeasurement({
      deviceId,
      messageId,
      timestamp,
      temperature,
      humidity,
      pressure,
      wifiRssi,
      uptime,
      totalRainTips,
      rainRate
    });

    // Also mirror to default station (e.g. RS-ESP32S3-01) if different, so UI cards update instantly
    if (env.DEFAULT_STATION_ID && deviceId !== env.DEFAULT_STATION_ID) {
      await dataStore.upsertDevice({
        deviceId: env.DEFAULT_STATION_ID,
        name: `Trạm ${env.DEFAULT_STATION_ID}`,
        location: 'Trạm khí tượng tự động',
        rainMmPerTip: 0.64
      });
      await dataStore.updateDeviceStatus(env.DEFAULT_STATION_ID, true, timestamp, wifiRssi, uptime);
      await dataStore.saveMeasurement({
        deviceId: env.DEFAULT_STATION_ID,
        messageId: `${messageId}-def`,
        timestamp,
        temperature,
        humidity,
        pressure,
        wifiRssi,
        uptime,
        totalRainTips,
        rainRate
      });
    }

    // Check if rain tips incremented to register a RainEvent
    const prevTips = lastKnownTips.get(deviceId);
    if (prevTips !== undefined && totalRainTips > prevTips) {
      const increment = totalRainTips - prevTips;
      const savedEvent = await dataStore.saveRainEvent({
        deviceId,
        eventId: `rain-${Date.now()}-${increment}`,
        timestamp,
        tipCount: increment,
        calibrationFactor: 0.64
      });
      if (savedEvent) {
        const stats = await rainfallService.getStatistics(deviceId);
        emitRainUpdate(deviceId, savedEvent, stats);
      }
    }
    lastKnownTips.set(deviceId, totalRainTips);

    if (saved) {
      // Broadcast to connected frontend clients in real time
      emitTelemetryUpdate(deviceId, saved, {
        deviceId,
        messageId,
        timestamp,
        temperature,
        humidity,
        pressure,
        wifiRssi,
        uptime,
        totalRainTips,
        rainRate,
        sequenceNumber: json.sequenceNumber || json.rain_reset_sequence || 0,
        bootId: json.bootId || 'boot-esp32',
        firmwareVersion: '1.0.0'
      });

      // Evaluate alert rules
      const alert = await alertService.evaluateTelemetry(deviceId, saved, rainRate);
      if (alert) {
        emitNewAlert(alert);
      }

      logger.info(
        {
          deviceId,
          topic,
          temp: temperature,
          hum: humidity,
          press: pressure,
          tips: totalRainTips
        },
        'Telemetry message processed and stored successfully'
      );
    }
  } catch (err: unknown) {
    const error = err as Error;
    logger.error({ err: error.message, topic }, 'Error processing telemetry MQTT message');
  }
}
