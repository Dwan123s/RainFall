import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateRainfall,
  calculateRainRate,
  calculateDewPoint,
  getStartOfDayInTimezone
} from '@rainsense/shared';

describe('Rainfall & Weather Calculation Tests', () => {
  it('should correctly calculate rainfall accumulation: tips * mmPerTip', () => {
    // 10 tips * 0.25 mm/tip = 2.50 mm
    const result1 = calculateRainfall(10, 0.25);
    assert.strictEqual(result1, 2.5);

    // 4 tips * 0.2794 mm/tip = 1.12 mm
    const result2 = calculateRainfall(4, 0.2794);
    assert.strictEqual(result2, 1.12);

    // 0 tips should be 0 mm
    assert.strictEqual(calculateRainfall(0, 0.25), 0);
  });

  it('should calculate rain rate over time window accurately', () => {
    // 2.5 mm accumulated over 15 minutes = 2.5 / (15/60) = 10.0 mm/h
    const rate15m = calculateRainRate(2.5, 15);
    assert.strictEqual(rate15m, 10.0);

    // 1.0 mm in 5 minutes = 1.0 / (5/60) = 12.0 mm/h
    const rate5m = calculateRainRate(1.0, 5);
    assert.strictEqual(rate5m, 12.0);

    // 0 mm should be 0 mm/h
    assert.strictEqual(calculateRainRate(0, 5), 0);
  });

  it('should correctly compute dew point using Magnus-Tetens formula', () => {
    // At T=30°C and RH=70%, dew point is ~23.9°C
    const dp = calculateDewPoint(30, 70);
    assert.ok(dp >= 23.5 && dp <= 24.5, `Expected dew point around 23.9°C, got ${dp}`);

    // At 100% relative humidity, dew point equals dry-bulb temperature
    const dp100 = calculateDewPoint(25, 100);
    assert.strictEqual(Math.round(dp100), 25);
  });

  it('should compute midnight start of day in Asia/Ho_Chi_Minh (UTC+7)', () => {
    // Test for a specific UTC timestamp: 2026-10-12 03:00 UTC (10:00 AM VN)
    const testDate = new Date('2026-10-12T03:00:00.000Z');
    const startOfDay = getStartOfDayInTimezone(testDate, 'Asia/Ho_Chi_Minh');

    // Midnight in Asia/Ho_Chi_Minh (UTC+7) on Oct 12 is Oct 11 17:00:00 UTC
    assert.strictEqual(startOfDay.toISOString(), '2026-10-11T17:00:00.000Z');
  });
});
