import { Request, Response } from 'express';
import { DeviceConfigUpdateSchema, DeviceCreateSchema } from '@rainsense/shared';
import { dataStore } from '../db/store';
import { publishMqttCommand } from '../mqtt/client';
import { handleCommandAckMessage } from '../mqtt/handlers/ack.handler';
import { env } from '../config/env';

export const deviceController = {
  async getDevices(req: Request, res: Response) {
    const devices = await dataStore.getAllDevices();
    return res.json({ success: true, data: devices });
  },

  async getDevice(req: Request, res: Response) {
    const { id } = req.params;
    const device = await dataStore.getDevice(id);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy thiết bị trạm' });
    }
    const config = await dataStore.getConfig(id);
    return res.json({ success: true, data: { ...device, configuration: config } });
  },

  async createDevice(req: Request, res: Response) {
    const parsed = DeviceCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }

    const created = await dataStore.upsertDevice(parsed.data);
    return res.status(201).json({ success: true, data: created });
  },

  async getConfig(req: Request, res: Response) {
    const { id } = req.params;
    const config = await dataStore.getConfig(id);
    return res.json({ success: true, data: config });
  },

  async updateConfig(req: Request, res: Response) {
    const { id } = req.params;
    const parsed = DeviceConfigUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }

    const device = await dataStore.getDevice(id);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Thiết bị không tồn tại' });
    }

    // 1. Create a command record in PENDING state
    const commandId = `cmd-cfg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const commandRecord = await dataStore.createCommand({
      deviceId: id,
      commandId,
      action: 'set_config',
      payload: parsed.data,
      status: 'PENDING'
    });

    // 2. Publish to MQTT command topic
    const commandPayload = {
      commandId,
      deviceId: id,
      action: 'set_config',
      payload: parsed.data,
      timestamp: new Date().toISOString()
    };
    await publishMqttCommand(id, commandPayload);

    // 3. In DEMO MODE or simulator mode, simulate hardware ACK after 1.5 seconds
    if (env.DEMO_MODE) {
      setTimeout(async () => {
        // Apply config locally
        await dataStore.updateConfig(id, parsed.data);
        if (parsed.data.name || parsed.data.location || parsed.data.timezone) {
          await dataStore.upsertDevice({
            deviceId: id,
            name: parsed.data.name || device.name,
            location: parsed.data.location,
            timezone: parsed.data.timezone
          });
        }
        // Emit ACK
        await handleCommandAckMessage(
          `weather/${id}/command/ack`,
          JSON.stringify({
            commandId,
            deviceId: id,
            status: 'SUCCESS',
            message: 'Cấu hình đã được lưu vào EEPROM của ESP32-S3 thành công',
            timestamp: new Date().toISOString()
          })
        );
      }, 1500);
    }

    return res.json({
      success: true,
      data: {
        command: commandRecord,
        status: 'PENDING',
        message: 'Lệnh cấu hình đã được gửi tới trạm qua MQTT. Đang chờ phản hồi xác nhận (ACK)...'
      }
    });
  },

  async sendCommand(req: Request, res: Response) {
    const { id } = req.params;
    const { action, payload } = req.body;

    if (!['reboot', 'calibrate_rain', 'ping'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Hành động lệnh không hợp lệ' });
    }

    const commandId = `cmd-${action}-${Date.now()}`;
    const commandRecord = await dataStore.createCommand({
      deviceId: id,
      commandId,
      action: action as any,
      payload: payload || {},
      status: 'PENDING'
    });

    await publishMqttCommand(id, {
      commandId,
      deviceId: id,
      action,
      payload: payload || {},
      timestamp: new Date().toISOString()
    });

    if (env.DEMO_MODE) {
      setTimeout(async () => {
        await handleCommandAckMessage(
          `weather/${id}/command/ack`,
          JSON.stringify({
            commandId,
            deviceId: id,
            status: 'SUCCESS',
            message: `Lệnh [${action}] đã được thực thi thành công trên vi điều khiển`,
            timestamp: new Date().toISOString()
          })
        );
      }, 1500);
    }

    return res.json({
      success: true,
      data: commandRecord
    });
  },

  async getCommands(req: Request, res: Response) {
    const { id } = req.params;
    const commands = await dataStore.getCommands(id);
    return res.json({ success: true, data: commands });
  },

  async resetData(req: Request, res: Response) {
    const { id } = req.params;
    await dataStore.clearTelemetryData(id);
    return res.json({
      success: true,
      message: `Đã xóa toàn bộ dữ liệu quan trắc giả lập của trạm ${id}. Thiết bị đã được chuyển sang chế độ chờ kết nối ESP32-S3.`
    });
  }
};
