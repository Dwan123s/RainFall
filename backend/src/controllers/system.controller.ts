import { Request, Response } from 'express';
import { env } from '../config/env';
import { getDbInfo, testPrismaConnectionDetail } from '../db/prisma';
import { getMqttInfo, testMqttConnection } from '../mqtt/client';

export const systemController = {
  /**
   * Returns current health and connectivity status of EMQX MQTT & Aiven Database
   */
  getStatus(req: Request, res: Response) {
    const dbInfo = getDbInfo();
    const mqttInfo = getMqttInfo();

    return res.json({
      success: true,
      data: {
        serverTime: new Date().toISOString(),
        mode: env.DEMO_MODE ? 'DEMO' : 'LIVE',
        defaultStationId: env.DEFAULT_STATION_ID,
        database: {
          ...dbInfo,
          type: dbInfo.isAiven ? 'Aiven Cloud PostgreSQL' : 'Local PostgreSQL'
        },
        mqtt: {
          ...mqttInfo,
          type: 'EMQX MQTT Broker'
        }
      }
    });
  },

  /**
   * Diagnostic probe for Aiven PostgreSQL database
   */
  async testDatabase(req: Request, res: Response) {
    const result = await testPrismaConnectionDetail();
    return res.status(result.success ? 200 : 500).json({
      success: result.success,
      data: result
    });
  },

  /**
   * Diagnostic probe for EMQX MQTT Broker
   */
  async testMqtt(req: Request, res: Response) {
    const { brokerUrl, username, password } = req.body || {};
    const result = await testMqttConnection(brokerUrl, username, password);
    return res.status(result.success ? 200 : 500).json({
      success: result.success,
      data: result
    });
  }
};
