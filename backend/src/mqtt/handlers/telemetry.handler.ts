import { TelemetryPayloadSchema, TelemetryPayload } from '../../shared';
import { dataStore } from '../../db/store';
import { alertService } from '../../services/alert.service';
import { emitTelemetryUpdate, emitNewAlert, emitDeviceStatus } from '../../socket/io';
import { logger } from '../../utils/logger';

export async function handleTelemetryMessage(topic: string, rawPayload: Buffer | string) {
  try {
    const json = JSON.parse(rawPayload.toString());
    const parseResult = TelemetryPayloadSchema.safeParse(json);

    if (!parseResult.success) {
      logger.warn({ errors: parseResult.error.format() }, 'Invalid telemetry payload structure');
      return;
    }

    const data: TelemetryPayload = parseResult.data;

    // Check message deduplication
    if (dataStore.isMessageProcessed(data.messageId)) {
      logger.debug({ messageId: data.messageId }, 'Duplicate telemetry message ignored');
      return;
    }

    // Update Device status
    await dataStore.updateDeviceStatus(
      data.deviceId,
      true,
      data.timestamp,
      data.wifiRssi,
      data.uptime
    );
    emitDeviceStatus(data.deviceId, true, data.timestamp, data.wifiRssi);

    // Save measurement to database
    const saved = await dataStore.saveMeasurement({
      deviceId: data.deviceId,
      messageId: data.messageId,
      timestamp: data.timestamp,
      temperature: data.temperature,
      humidity: data.humidity,
      pressure: data.pressure,
      wifiRssi: data.wifiRssi,
      uptime: data.uptime,
      totalRainTips: data.totalRainTips,
      rainRate: data.rainRate
    });

    if (saved) {
      // Broadcast to connected frontend clients in real time
      emitTelemetryUpdate(data.deviceId, saved, data);

      // Evaluate alert rules
      const alert = await alertService.evaluateTelemetry(data.deviceId, saved, data.rainRate);
      if (alert) {
        emitNewAlert(alert);
      }
    }
  } catch (err: unknown) {
    const error = err as Error;
    logger.error({ err: error.message }, 'Error processing telemetry MQTT message');
  }
}
