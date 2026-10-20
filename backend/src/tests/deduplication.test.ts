import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TelemetryPayloadSchema, RainEventPayloadSchema } from '../shared';
import { dataStore } from '../db/store';

describe('MQTT Ingestion & Deduplication Tests', () => {
  it('should reject invalid or out-of-range telemetry payload via Zod', () => {
    // Missing required fields
    const invalidPayload1 = {
      deviceId: 'TEST-DEV-01',
      temperature: 25.0
    };
    const res1 = TelemetryPayloadSchema.safeParse(invalidPayload1);
    assert.strictEqual(res1.success, false);

    // Impossible temperature (e.g. 150 °C exceeds sensor limit)
    const invalidPayload2 = {
      messageId: 'msg-999',
      deviceId: 'TEST-DEV-01',
      bootId: 'boot-1',
      sequenceNumber: 1,
      timestamp: new Date().toISOString(),
      temperature: 150.0, // Invalid: max 85
      humidity: 50,
      pressure: 1013,
      totalRainTips: 0,
      rainRate: 0,
      wifiRssi: -70,
      uptime: 100
    };
    const res2 = TelemetryPayloadSchema.safeParse(invalidPayload2);
    assert.strictEqual(res2.success, false);
  });

  it('should accept valid telemetry payload', () => {
    const valid = {
      messageId: 'msg-valid-01',
      deviceId: 'TEST-DEV-01',
      bootId: 'boot-1',
      sequenceNumber: 1,
      timestamp: new Date().toISOString(),
      temperature: 28.5,
      humidity: 65.0,
      pressure: 1012.3,
      totalRainTips: 5,
      rainRate: 0.0,
      wifiRssi: -65,
      uptime: 1200
    };
    const res = TelemetryPayloadSchema.safeParse(valid);
    assert.strictEqual(res.success, true);
  });

  it('should prevent duplicate messages from being saved twice (deduplication)', async () => {
    const uniqueMsgId = `dup-test-${Date.now()}`;
    const payload = {
      deviceId: 'TEST-STATION-DEDUP',
      messageId: uniqueMsgId,
      timestamp: new Date().toISOString(),
      temperature: 27.0,
      humidity: 70.0,
      pressure: 1010.0,
      wifiRssi: -60,
      uptime: 500
    };

    // First time saving
    const saved1 = await dataStore.saveMeasurement(payload);
    assert.ok(saved1 !== null, 'First save should succeed');

    // Second time saving same messageId
    const saved2 = await dataStore.saveMeasurement(payload);
    assert.strictEqual(saved2, null, 'Duplicate message must be rejected and return null');
  });

  it('should prevent duplicate rain event IDs from inflating rainfall totals', async () => {
    const rainEventId = `rain-dup-${Date.now()}`;
    const rainEvent = {
      deviceId: 'TEST-STATION-DEDUP',
      eventId: rainEventId,
      timestamp: new Date().toISOString(),
      tipCount: 1,
      calibrationFactor: 0.25
    };

    // First event
    const res1 = await dataStore.saveRainEvent(rainEvent);
    assert.ok(res1 !== null);
    assert.strictEqual(res1?.rainfallMm, 0.25);

    // Duplicate event
    const res2 = await dataStore.saveRainEvent(rainEvent);
    assert.strictEqual(res2, null, 'Duplicate rain event must be dropped without adding tips');
  });
});
