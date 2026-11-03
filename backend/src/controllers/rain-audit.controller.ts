import type { Response, Request } from 'express';
import { z } from 'zod';
import { dataStore } from '../db/store';
import { withReadDiagnostics } from '../db/read-diagnostics';
import { readRainLedger } from '../services/rain-ledger';
import type { AuthRequest } from '../middleware/auth.middleware';

const periodSchema = z.object({ from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }), note: z.string().trim().min(1).max(200) }).strict();
export const rainAuditController = {
  async markAllRecorded(req: AuthRequest, res: Response) {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ success: false, error: 'Cần tài khoản quản trị' });
    try {
      const cutoff = new Date();
      const { value: events, source } = await withReadDiagnostics(() => dataStore.getRainEvents(req.params.id, undefined, cutoff.toISOString()));
      if (source !== 'postgresql') return res.status(503).json({ success: false, error: 'Cần đọc được PostgreSQL để đánh dấu bền vững toàn bộ lịch sử' });
      const times = events.flatMap((e) => [Date.parse(e.timestamp), Date.parse(e.intervalFrom ?? e.timestamp)]).filter(Number.isFinite);
      if (!times.length) return res.json({ success: true, data: { events: 0, cutoff: cutoff.toISOString() } });
      const earliest = times.reduce((a, b) => Math.min(a, b));
      const period = await dataStore.saveRainTestPeriod({ deviceId: req.params.id, from: new Date(earliest).toISOString(), to: new Date(cutoff.getTime() + 1).toISOString(),
        note: 'Người vận hành xác nhận toàn bộ dữ liệu đã ghi đến mốc chốt là thử nước', createdBy: req.user.id });
      return res.status(201).json({ success: true, data: { period, events: events.length, tips: events.reduce((s, e) => s + e.tipCount, 0), cutoff: cutoff.toISOString() } });
    } catch { return res.status(503).json({ success: false, error: 'Chưa đánh dấu được toàn bộ dữ liệu; chưa thay đổi tổng để báo cáo thành công' }); }
  },
  async list(req: Request, res: Response) {
    try {
      const from = typeof req.query.from === 'string' ? req.query.from : new Date(Date.now() - 86400000).toISOString();
      const to = typeof req.query.to === 'string' ? req.query.to : new Date().toISOString();
      if (!Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)) || Date.parse(to) <= Date.parse(from) || Date.parse(to) - Date.parse(from) > 7 * 86400000 || Date.parse(to) > Date.now() + 60000) return res.status(400).json({ success: false, error: 'Chọn khoảng đã diễn ra, tối đa 7 ngày' });
      const { value: events, source } = await withReadDiagnostics(() => readRainLedger(req.params.id, from, to));
      const periods = await dataStore.getRainTestPeriods(req.params.id);
      return res.json({ success: true, data: { from, to, source, events: events.slice(-2000), truncated: events.length > 2000,
        periods: periods.map(({ createdBy, ...p }) => p) } });
    } catch { return res.status(503).json({ success: false, error: 'Chưa đọc được sổ sự kiện và nhãn thử nước; chưa thể xác nhận phân loại' }); }
  },
  async create(req: AuthRequest, res: Response) {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ success: false, error: 'Cần tài khoản quản trị để đánh dấu nước thử' });
    const parsed = periodSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Cần giờ bắt đầu, kết thúc ISO và ghi chú thử nước' });
    const { from, to, note } = parsed.data;
    const now = Date.now();
    if (Date.parse(to) <= Date.parse(from) || Date.parse(to) - Date.parse(from) > 7 * 86400000 || Date.parse(from) > now + 5000 || Date.parse(to) > now + 2 * 3600000) return res.status(400).json({ success: false, error: 'Khoảng thử phải hợp lệ, tối đa 7 ngày; phiên đang thử tự kết thúc trong tối đa 2 giờ' });
    try {
      const period = await dataStore.saveRainTestPeriod({ deviceId: req.params.id, from: new Date(from).toISOString(), to: new Date(to).toISOString(), note, createdBy: req.user.id });
      return res.status(201).json({ success: true, data: period });
    } catch { return res.status(503).json({ success: false, error: 'Chưa lưu được nhãn thử nước; vui lòng thử lại' }); }
  },
  async stop(req: AuthRequest, res: Response) {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ success: false, error: 'Cần tài khoản quản trị' });
    try {
      await dataStore.endRainTestPeriod(req.params.id, req.params.periodId, new Date().toISOString());
      return res.json({ success: true, data: { stopped: true } });
    } catch { return res.status(409).json({ success: false, error: 'Chưa kết thúc được phiên; kiểm tra phiên còn hoạt động và thử lại' }); }
  }
};
