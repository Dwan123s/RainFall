import { describe, it } from 'node:test';
import assert from 'node:assert';
import { dataStore } from '../db/store';
import { alertService } from '../services/alert.service';

describe('Device Management & Offline Detection Tests', () => {
  it('should support per-station configurable calibration factor', async () => {
    const devId = `DEV-CALIB-${Date.now()}`;
    await dataStore.upsertDevice({
      deviceId: devId,
      name: 'Station Calibration Test',
      rainMmPerTip: 0.20 // Configured as 0.20 mm/tip
    });

    const cfg = await dataStore.getConfig(devId);
    assert.strictEqual(cfg?.rainMmPerTip, 0.20);

    // Update calibration to 0.35 mm/tip
    await dataStore.updateConfig(devId, { rainMmPerTip: 0.35 });
    const updatedCfg = await dataStore.getConfig(devId);
    assert.strictEqual(updatedCfg?.rainMmPerTip, 0.35);
  });

  it('should detect stale/offline device when lastSeen exceeds threshold', async () => {
    const devId = `DEV-OFFLINE-${Date.now()}`;
    await dataStore.upsertDevice({
      deviceId: devId,
      name: 'Station Offline Test'
    });

    // Set last seen 5 minutes ago (300 seconds ago)
    const fiveMinAgo = new Date(Date.now() - 300 * 1000).toISOString();
    await dataStore.updateDeviceStatus(devId, true, fiveMinAgo);

    // Trigger check
    const alert = await alertService.checkDeviceOffline(devId);
    assert.ok(alert !== null, 'Alert should be created for offline device');
    assert.strictEqual(alert?.type, 'DEVICE_OFFLINE');
    assert.strictEqual(alert?.severity, 'CRITICAL');

    const dev = await dataStore.getDevice(devId);
    assert.strictEqual(dev?.isOnline, false, 'Device online flag should be updated to false');
  });
});
