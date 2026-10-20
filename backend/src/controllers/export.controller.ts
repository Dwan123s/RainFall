import { Request, Response } from 'express';
import { exportService } from '../services/export.service';
import { env } from '../config/env';

export const exportController = {
  async exportCsv(req: Request, res: Response) {
    const deviceId = (req.query.deviceId as string) || env.DEFAULT_STATION_ID;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const types = req.query.types
      ? (req.query.types as string).split(',')
      : ['temperature', 'humidity', 'pressure', 'rain'];

    const csvData = await exportService.exportCsv(deviceId, from, to, types);

    const filename = `rainsense-export-${deviceId}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csvData);
  }
};
