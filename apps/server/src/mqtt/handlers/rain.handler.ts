import { RainEventPayloadSchema, RainEventPayload } from '@rainsense/shared';
import { dataStore } from '../../db/store';
import { rainfallService } from '../../services/rainfall.service';
import { alertService } from '../../services/alert.service';
import { emitRainUpdate, emitNewAlert } from '../../socket/io';
import { logger } from '../../utils/logger';

export async function handleRainEventMessage(topic: string, rawPayload: Buffer | string) {
  try {
    const json = JSON.parse(rawPayload.toString());
    const parseResult = RainEventPayloadSchema.safeParse(json);

    if (!parseResult.success) {
      logger.warn({ errors: parseResult.error.format() }, 'Invalid rain event payload structure');
      return;
    }

    const data: RainEventPayload = parseResult.data;

    // Check message deduplication
    if (dataStore.isMessageProcessed(data.messageId)) {
      logger.debug({ messageId: data.messageId }, 'Duplicate rain event ignored');
      return;
    }

    // Retrieve station specific calibration factor (mm/tip)
    const config = await dataStore.getConfig(data.deviceId);
    const calibrationFactor = config?.rainMmPerTip ?? 0.25;

    // Save Rain Event
    const savedEvent = await dataStore.saveRainEvent({
      deviceId: data.deviceId,
      eventId: data.messageId,
      timestamp: data.timestamp,
      tipCount: data.tipCount,
      calibrationFactor
    });

    if (savedEvent) {
      // Recalculate statistics
      const stats = await rainfallService.getStatistics(data.deviceId);

      // Realtime broadcast to web dashboard
      emitRainUpdate(data.deviceId, savedEvent, stats);

      // Check Heavy Rain alert rule if applicable
      const latestMeas = await dataStore.getLatestMeasurement(data.deviceId);
      if (latestMeas) {
        const alert = await alertService.evaluateTelemetry(data.deviceId, latestMeas, stats.currentRateMmH);
        if (alert) {
          emitNewAlert(alert);
        }
      }

      logger.info(
        { deviceId: data.deviceId, tipCount: data.tipCount, mm: savedEvent.rainfallMm, currentRate: stats.currentRateMmH },
        'Processed valid rain gauge bucket tip event'
      );
    }
  } catch (err: unknown) {
    const error = err as Error;
    logger.error({ err: error.message }, 'Error processing rain MQTT message');
  }
}
