/**
 * Instantaneous or Batched Rain Event published by ESP32
 * Topic: weather/{deviceId}/rain
 */
export interface RainEventPayload {
  messageId: string;
  deviceId: string;
  bootId: string;
  sequenceNumber: number;
  timestamp: string; // ISO 8601 UTC
  tipCount: number; // Number of tips in this event batch (typically 1)
  cumulativeTips: number; // Total cumulative tips known by device
  durationMs?: number; // Milliseconds since previous tip (if available)
  instantIntensityMmH?: number; // Estimated instantaneous intensity
}

/**
 * Persisted Rain Event in database
 */
export interface RainEventRecord {
  id: string;
  deviceId: string;
  eventId: string;
  timestamp: string;
  tipCount: number;
  calibrationFactor: number; // mm per tip configured at time of event
  rainfallMm: number; // tipCount * calibrationFactor
  createdAt: string;
}

/**
 * Aggregated Rainfall Statistics
 */
export interface RainfallStatistics {
  todayMm: number;
  yesterdayMm: number;
  rolling24hMm: number;
  last7DaysMm: number;
  currentMonthMm: number;
  lifetimeMm: number;
  currentRateMmH: number; // 5-minute rolling intensity
  fiveMinAvgMmH: number;
  maxObservedRateMmH: number;
  timeOfMaxRate?: string;
  totalTipsToday: number;
  lifetimeTips: number;
  calibrationFactor: number;
  lastTipTimestamp?: string;
  currentRainEvent?: {
    startedAt: string;
    totalMm: number;
    durationMinutes: number;
    active: boolean;
  };
}
