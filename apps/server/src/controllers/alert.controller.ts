import { Request, Response } from 'express';
import { AlertRuleCreateSchema, AlertRuleUpdateSchema } from '@rainsense/shared';
import { dataStore } from '../db/store';

export const alertController = {
  async getAlerts(req: Request, res: Response) {
    const deviceId = req.query.deviceId as string | undefined;
    const isRead = req.query.isRead !== undefined ? req.query.isRead === 'true' : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

    const list = await dataStore.getAlerts({ deviceId, isRead, limit });
    return res.json({ success: true, data: list });
  },

  async resolveAlert(req: Request, res: Response) {
    const { id } = req.params;
    const resolved = await dataStore.resolveAlert(id);
    if (!resolved) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy cảnh báo' });
    }
    return res.json({ success: true, data: resolved });
  },

  async getRules(req: Request, res: Response) {
    const { deviceId } = req.params;
    const rules = await dataStore.getAlertRules(deviceId);
    return res.json({ success: true, data: rules });
  },

  async createRule(req: Request, res: Response) {
    const parsed = AlertRuleCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }
    const created = await dataStore.createAlertRule(parsed.data as any);
    return res.status(201).json({ success: true, data: created });
  },

  async updateRule(req: Request, res: Response) {
    const { id } = req.params;
    const parsed = AlertRuleUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }
    const updated = await dataStore.updateAlertRule(id, parsed.data as any);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy quy tắc cảnh báo' });
    }
    return res.json({ success: true, data: updated });
  }
};
