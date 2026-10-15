import { Request, Response } from 'express';
import { env } from '../config/env';
import { stationSimulator } from '../mqtt/simulator';
import { getSocketIO } from '../socket/io';

export const demoController = {
  getMode(req: Request, res: Response) {
    return res.json({
      success: true,
      data: {
        mode: env.DEMO_MODE ? 'DEMO' : 'LIVE',
        simulatorActive: stationSimulator.getRunningStatus()
      }
    });
  },

  toggleMode(req: Request, res: Response) {
    const { enable } = req.body;
    env.DEMO_MODE = enable !== undefined ? Boolean(enable) : !env.DEMO_MODE;

    if (env.DEMO_MODE) {
      stationSimulator.start(4000);
    } else {
      stationSimulator.stop();
    }

    const io = getSocketIO();
    if (io) {
      io.emit('mode:change', { mode: env.DEMO_MODE ? 'DEMO' : 'LIVE' });
    }

    return res.json({
      success: true,
      data: {
        mode: env.DEMO_MODE ? 'DEMO' : 'LIVE',
        simulatorActive: stationSimulator.getRunningStatus()
      }
    });
  },

  async simulateTip(req: Request, res: Response) {
    const count = req.body.count ? parseInt(req.body.count, 10) : 1;
    const result = await stationSimulator.triggerManualTip(count);
    return res.json({
      success: true,
      data: {
        message: `Đã kích hoạt giả lập ${count} nhịp lật gầu cảm biến Hall A3144`,
        ...result
      }
    });
  }
};
