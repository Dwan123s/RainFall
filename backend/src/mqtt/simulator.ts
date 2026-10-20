import { env } from '../config/env';
import { handleTelemetryMessage } from './handlers/telemetry.handler';
import { handleRainEventMessage } from './handlers/rain.handler';
import { logger } from '../utils/logger';

export class StationSimulator {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private deviceId = env.DEFAULT_STATION_ID;
  private bootId = `boot-${Date.now()}`;
  private sequenceNumber = 1000;
  private totalRainTips = 42;
  private uptime = 172800;
  private baseTemp = 30.2;
  private baseHumidity = 68.0;
  private basePressure = 1011.4;
  private rainBurstCountdown = 0;

  start(intervalMs: number = 5000) {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info({ deviceId: this.deviceId, intervalMs }, 'Starting realistic IoT Station Simulator (DEMO MODE)...');

    this.timer = setInterval(() => {
      this.tick();
    }, intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info('Station Simulator stopped.');
  }

  getRunningStatus(): boolean {
    return this.isRunning;
  }

  async triggerManualTip(tipCount: number = 1) {
    this.totalRainTips += tipCount;
    const nowIso = new Date().toISOString();
    const eventPayload = {
      messageId: `sim-rain-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      deviceId: this.deviceId,
      bootId: this.bootId,
      sequenceNumber: ++this.sequenceNumber,
      timestamp: nowIso,
      tipCount,
      cumulativeTips: this.totalRainTips,
      durationMs: 4500
    };

    await handleRainEventMessage(
      `weather/${this.deviceId}/rain`,
      JSON.stringify(eventPayload)
    );

    return { totalRainTips: this.totalRainTips, tipCount };
  }

  private async tick() {
    try {
      this.uptime += 5;
      this.sequenceNumber++;

      // Subtle realistic micro-fluctuations
      const tempDelta = (Math.random() - 0.5) * 0.2;
      this.baseTemp = Math.max(22, Math.min(38, Math.round((this.baseTemp + tempDelta) * 10) / 10));

      const humDelta = (Math.random() - 0.5) * 0.4;
      this.baseHumidity = Math.max(30, Math.min(95, Math.round((this.baseHumidity + humDelta) * 10) / 10));

      const pressDelta = (Math.random() - 0.5) * 0.1;
      this.basePressure = Math.max(995, Math.min(1030, Math.round((this.basePressure + pressDelta) * 10) / 10));

      const rssi = -60 - Math.floor(Math.random() * 8);

      // Rain simulation logic: occasionally trigger rain showers
      let rainRate = 0;
      if (this.rainBurstCountdown > 0) {
        this.rainBurstCountdown--;
        this.totalRainTips++;
        rainRate = Math.round((1 * 0.25 * (60 / 5) * 10)) / 10; // ~3.0 mm/h

        const rainPayload = {
          messageId: `sim-rain-${Date.now()}-${this.sequenceNumber}`,
          deviceId: this.deviceId,
          bootId: this.bootId,
          sequenceNumber: this.sequenceNumber,
          timestamp: new Date().toISOString(),
          tipCount: 1,
          cumulativeTips: this.totalRainTips,
          durationMs: 5000
        };
        await handleRainEventMessage(`weather/${this.deviceId}/rain`, JSON.stringify(rainPayload));
      } else {
        // 5% chance to start a short rain shower of 4 ticks
        if (Math.random() < 0.05) {
          this.rainBurstCountdown = 4;
        }
      }

      const telemetryPayload = {
        messageId: `sim-tel-${Date.now()}-${this.sequenceNumber}`,
        deviceId: this.deviceId,
        bootId: this.bootId,
        sequenceNumber: this.sequenceNumber,
        timestamp: new Date().toISOString(),
        temperature: this.baseTemp,
        humidity: this.baseHumidity,
        pressure: this.basePressure,
        totalRainTips: this.totalRainTips,
        rainRate,
        wifiRssi: rssi,
        uptime: this.uptime,
        firmwareVersion: '1.2.0-sim',
        batteryVoltage: 4.12
      };

      await handleTelemetryMessage(
        `weather/${this.deviceId}/telemetry`,
        JSON.stringify(telemetryPayload)
      );
    } catch (err: unknown) {
      const error = err as Error;
      logger.error({ err: error.message }, 'Simulator tick error');
    }
  }
}

export const stationSimulator = new StationSimulator();
