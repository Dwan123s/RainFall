export type HardwareVariant = 'unknown' | 'oled-s3' | 'rainsense-s3';

export interface StationProfile {
  hardwareVariant: HardwareVariant;
  wiringVerified: boolean;
  latitude?: number;
  longitude?: number;
  elevationMeters?: number;
}

export interface KnowledgeSource {
  id: string;
  title: string;
  version: string;
  path: string;
  url?: string;
}

export interface MeasurementSummary {
  min: number;
  max: number;
  avg: number;
  sampleCount?: number;
  firstObservedAt?: string;
  lastObservedAt?: string;
  firstValue?: number;
  lastValue?: number;
  coverageComplete?: boolean;
}

export interface WeatherFeatures {
  from: string;
  to: string;
  sampleCount: number;
  invalidSampleCount: number;
  coverageComplete: boolean;
  temperature: MeasurementSummary | null;
  humidity: MeasurementSummary | null;
  pressure: MeasurementSummary | null;
  availableSampleCount?: number;
  pressureDelta3hHpa: number | null;
  temperatureDelta1hC: number | null;
}

export interface ForecastPeriod {
  from: string;
  to: string;
  temperatureC: number | null;
  humidityPercent: number | null;
  precipitationMm: number | null;
  precipitationProbabilityPercent: number | null;
}

export interface ForecastContext {
  status: 'available' | 'missing_location' | 'disabled' | 'unavailable' | 'unsupported_range';
  provider: 'Open-Meteo';
  sourceUrl: string;
  fetchedAt: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  requestedFrom: string;
  requestedTo: string;
  latitude: number | null;
  longitude: number | null;
  periods: ForecastPeriod[];
}

export interface ChatMetadata {
  mode: 'llm' | 'fallback' | 'calculation' | 'forecast' | 'analysis';
  provider: 'gemini' | 'local' | 'open-meteo';
  model: string | null;
  generatedAt: string;
  fallbackReason?: 'missing_api_key' | 'model_unavailable' | 'backend_unavailable';
  sources: KnowledgeSource[];
}
