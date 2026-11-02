import { it } from 'node:test';
import assert from 'node:assert/strict';
import { makeExamples, trainTemperatureModel } from './train-weather.mjs';

// Synthetic data is strictly a test fixture; the trainer CLI never generates observations.
const start = Date.parse('2026-01-01T00:00:00Z');
const payload = { deviceId: 'TRAIN-TEST', source: 'postgresql', demo: false, historyTruncated: false,
  records: Array.from({ length: 4 * 24 * 60 }, (_, i) => ({ deviceId: 'TRAIN-TEST', timestamp: new Date(start + i * 60000).toISOString(),
    createdAt: new Date(start + i * 60000).toISOString(), temperature: 27 + 3 * Math.sin(i / 1440 * 2 * Math.PI), humidity: 75, pressure: 1009 })) };
it('trains and evaluates on later periods with purged labels and never auto-enables a local forecast', () => {
  const model = trainTemperatureModel(payload);
  assert.equal(model.readyForDeployment, false);
  assert.ok(model.split.trainLastTarget < model.split.validationStart);
  assert.ok(model.split.validationLastTarget < model.split.testStart);
  assert.ok(Number.isFinite(model.metrics.test.modelMaeC));
  assert.ok(model.metrics.test.modelMaeC < model.metrics.test.persistenceMaeC);
});
it('rejects simulated, truncated or volatile data and does not label a telemetry outage', () => {
  assert.throws(() => makeExamples({ ...payload, source: 'memory' }), /PostgreSQL/);
  assert.throws(() => makeExamples({ ...payload, demo: true }), /non-demo/);
  assert.throws(() => makeExamples({ ...payload, historyTruncated: true }), /non-truncated/);
  const incomplete = { ...payload, records: payload.records.filter((_, i) => i < 100 || i > 500) };
  const examples = makeExamples(incomplete);
  assert.ok(examples.every((r) => r.targetAt < start + 100 * 60000 || r.at - 3600000 > start + 498 * 60000));
});
it('does not use a late-arriving observation as a feature known in the past', () => {
  const late = { ...payload, records: payload.records.map((r) => ({ ...r, createdAt: new Date(start + 10 * 86400000).toISOString() })) };
  assert.equal(makeExamples(late).length, 0);
});
