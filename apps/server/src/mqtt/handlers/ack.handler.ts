import { DeviceCommandAckSchema } from '@rainsense/shared';
import { dataStore } from '../../db/store';
import { emitCommandStatus } from '../../socket/io';
import { logger } from '../../utils/logger';

export async function handleCommandAckMessage(topic: string, rawPayload: Buffer | string) {
  try {
    const json = JSON.parse(rawPayload.toString());
    const parseResult = DeviceCommandAckSchema.safeParse(json);

    if (!parseResult.success) {
      logger.warn({ errors: parseResult.error.format() }, 'Invalid command ACK payload');
      return;
    }

    const data = parseResult.data;
    const status = data.status === 'SUCCESS' ? 'APPLIED' : 'FAILED';

    const updated = await dataStore.updateCommandStatus(data.commandId, status, data.message);

    if (updated) {
      emitCommandStatus(updated);
      logger.info(
        { commandId: data.commandId, status, msg: data.message },
        'Command ACK received and applied'
      );
    }
  } catch (err: unknown) {
    const error = err as Error;
    logger.error({ err: error.message }, 'Error processing command ACK MQTT message');
  }
}
