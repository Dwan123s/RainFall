import { DeviceStatusPayloadSchema } from '../../shared';
import { dataStore } from '../../db/store';
import { emitDeviceStatus } from '../../socket/io';
import { logger } from '../../utils/logger';

export async function handleStatusMessage(topic: string, rawPayload: Buffer | string) {
  try {
    const json = JSON.parse(rawPayload.toString());
    const parseResult = DeviceStatusPayloadSchema.safeParse(json);

    if (!parseResult.success) {
      logger.warn({ errors: parseResult.error.format() }, 'Invalid device status payload');
      return;
    }

    const data = parseResult.data;
    const isOnline = data.status === 'online';

    await dataStore.updateDeviceStatus(
      data.deviceId,
      isOnline,
      data.timestamp,
      data.wifiRssi,
      data.uptime
    );

    emitDeviceStatus(data.deviceId, isOnline, data.timestamp, data.wifiRssi);
    logger.info({ deviceId: data.deviceId, isOnline, reason: data.reason }, 'Station status updated');
  } catch (err: unknown) {
    const error = err as Error;
    logger.error({ err: error.message }, 'Error processing status MQTT message');
  }
}
