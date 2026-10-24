import { dataStore } from '../../db/store';
import { alertService } from '../../services/alert.service';
import { rainfallService } from '../../services/rainfall.service';
import { emitTelemetryUpdate, emitNewAlert, emitDeviceStatus, emitRainUpdate } from '../../socket/io';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

// Track last known tip count and reset sequence per device to detect bucket tip increments & hardware resets
const lastKnownTips = new Map<string, number>();
const lastKnownResetSeq = new Map<string, number>();

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
    const resetSeq: number = json.rain_reset_sequence ?? json.sequenceNumber ?? 0;

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
    dataStore.markMessageProcessed(messageId);

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

    // Target devices to synchronize
    const targets = [deviceId];
    if (stationIdFromTopic && !targets.includes(stationIdFromTopic)) targets.push(stationIdFromTopic);
    if (env.DEFAULT_STATION_ID && !targets.includes(env.DEFAULT_STATION_ID)) targets.push(env.DEFAULT_STATION_ID);

    // Check for HARDWARE RESET (User pressed BOOT button on ESP32 or rain_reset_sequence incremented)
    const prevResetSeq = lastKnownResetSeq.get(deviceId);
    const prevTips = lastKnownTips.get(deviceId);
    const isHardwareReset =
      (prevResetSeq !== undefined && resetSeq > prevResetSeq) ||
      (prevTips !== undefined && prevTips > 0 && totalRainTips === 0) ||
      (totalRainTips === 0 && resetSeq > 0);

    if (isHardwareReset) {
      logger.info({ deviceId, resetSeq, prevResetSeq }, 'Hardware rain reset signal received! Purging previous rain events...');
      for (const tid of targets) {
        await dataStore.clearRainEvents(tid);
        const resetStats = await rainfallService.getStatistics(tid);
        emitRainUpdate(tid, null, resetStats);
      }
      lastKnownTips.set(deviceId, 0);
      lastKnownResetSeq.set(deviceId, resetSeq);
    } else {
      // Check if rain tips incremented to register a RainEvent
      let increment = 0;
      if (prevTips !== undefined && totalRainTips > prevTips) {
        increment = totalRainTips - prevTips;
      }

      if (increment > 0) {
        for (const tid of targets) {
          const savedEvent = await dataStore.saveRainEvent({
            deviceId: tid,
            eventId: `rain-${tid}-${messageId}-${totalRainTips}`,
            timestamp,
            tipCount: increment,
            calibrationFactor: 0.64
          });
          if (savedEvent) {
            const stats = await rainfallService.getStatistics(tid);
            const isPrimary = (tid === env.DEFAULT_STATION_ID || (!env.DEFAULT_STATION_ID && tid === deviceId));
            emitRainUpdate(tid, savedEvent, stats, isPrimary);
          }
        }
      }
      lastKnownTips.set(deviceId, totalRainTips);
      if (prevResetSeq === undefined) {
        lastKnownResetSeq.set(deviceId, resetSeq);
      }
    }

    if (saved) {
      // Broadcast to connected frontend clients in real time
      const primaryId = env.DEFAULT_STATION_ID || deviceId;
      emitTelemetryUpdate(primaryId, saved, {
        deviceId: primaryId,
        messageId,
        timestamp,
        temperature,
        humidity,
        pressure,
        wifiRssi,
        uptime,
        totalRainTips,
        rainRate,
        sequenceNumber: resetSeq,
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
