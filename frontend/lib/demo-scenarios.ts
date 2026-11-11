import { formatTimeVi, formatDateTimeVi } from './utils';

export type DemoScenarioId = 'low' | 'moderate' | 'high' | 'critical';

export interface DemoScenarioConfig {
  id: DemoScenarioId;
  code: string;
  name: string;
  badgeLabel: string;
  shortLabel: string;
  description: string;
  baseTemp: number; // °C
  baseHumidity: number; // %
  basePressure: number; // hPa
  pressureTrendCategory: 'STABLE' | 'FALLING' | 'RAPIDLY_FALLING';
  startTemp: number;
  startHumidity: number;
  startPressure: number;
}

export const DEMO_SCENARIOS: Record<DemoScenarioId, DemoScenarioConfig> = {
  low: {
    id: 'low',
    code: 'Demo 1',
    name: 'Nguy cơ Thấp (An toàn)',
    badgeLabel: 'Demo 1: Thấp',
    shortLabel: 'Thấp',
    description: 'Trời tạnh ráo, không khí thoáng mát, cống rãnh lưu thông tốt, nguy cơ ngập lụt ở mức tối thiểu.',
    baseTemp: 29.4,
    baseHumidity: 62.5,
    basePressure: 1013.8,
    pressureTrendCategory: 'STABLE',
    startTemp: 29.8,
    startHumidity: 60.2,
    startPressure: 1013.2
  },
  moderate: {
    id: 'moderate',
    code: 'Demo 2',
    name: 'Nguy cơ Trung bình (Cần lưu ý)',
    badgeLabel: 'Demo 2: Trung bình',
    shortLabel: 'Trung bình',
    description: 'Độ ẩm không khí tăng cao, áp suất giảm nhẹ, đất bắt đầu ẩm, cần lưu ý tại các điểm thoát nước chậm.',
    baseTemp: 26.8,
    baseHumidity: 78.5,
    basePressure: 1008.2,
    pressureTrendCategory: 'FALLING',
    startTemp: 29.2,
    startHumidity: 64.0,
    startPressure: 1013.0
  },
  high: {
    id: 'high',
    code: 'Demo 3',
    name: 'Nguy cơ Cao (Cảnh báo ngập)',
    badgeLabel: 'Demo 3: Cao',
    shortLabel: 'Cao',
    description: 'Thời tiết giông gió, áp suất khí quyển giảm nhanh, đất ngậm no nước, nguy cơ ngập tăng cao.',
    baseTemp: 24.6,
    baseHumidity: 88.6,
    basePressure: 1003.4,
    pressureTrendCategory: 'RAPIDLY_FALLING',
    startTemp: 29.4,
    startHumidity: 68.0,
    startPressure: 1013.5
  },
  critical: {
    id: 'critical',
    code: 'Demo 4',
    name: 'Nguy cơ Rất cao (Nguy hiểm)',
    badgeLabel: 'Demo 4: Rất cao',
    shortLabel: 'Rất cao',
    description: 'Thời tiết bão / áp thấp nhiệt đới sâu, đất bão hòa nước đỉnh điểm, cảnh báo nguy cơ ngập sâu diện rộng.',
    baseTemp: 23.2,
    baseHumidity: 94.6,
    basePressure: 998.2,
    pressureTrendCategory: 'RAPIDLY_FALLING',
    startTemp: 29.0,
    startHumidity: 72.0,
    startPressure: 1012.8
  }
};

export interface DemoEnvironmentData {
  temperature: number;
  humidity: number;
  pressure: number;
  pressureTrend: {
    category: 'STABLE' | 'FALLING' | 'RAPIDLY_FALLING';
    deltaHpa: number;
    labelVi: string;
  };
  scoreJitter: number;
}

export function getDemoEnvironment(scenarioId: DemoScenarioId, tick: number): DemoEnvironmentData {
  const s = DEMO_SCENARIOS[scenarioId] || DEMO_SCENARIOS.low;

  // Gentle, realistic wave + subtle noise (cập nhật 10 giây/lần giống Live mode, không nhảy vọt)
  const tempNoise = Math.round((Math.sin(tick * 0.35) * 0.18 + Math.cos(tick * 0.75) * 0.06) * 10) / 10;
  const humNoise = Math.round((Math.cos(tick * 0.28) * 0.45 + Math.sin(tick * 0.65) * 0.15) * 10) / 10;
  const pressNoise = Math.round((Math.sin(tick * 0.3) * 0.2 + Math.cos(tick * 0.8) * 0.08) * 10) / 10;
  const scoreNoise = Math.round(Math.sin(tick * 0.4) * 2);

  const temperature = Math.round((s.baseTemp + tempNoise) * 10) / 10;
  const humidity = Math.min(99.9, Math.max(20, Math.round((s.baseHumidity + humNoise) * 10) / 10));
  const pressure = Math.round((s.basePressure + pressNoise) * 10) / 10;

  let deltaHpa = 0.0;
  let labelVi = 'Ổn định';
  if (s.pressureTrendCategory === 'RAPIDLY_FALLING') {
    deltaHpa = -3.2 + Math.round((Math.sin(tick) * 0.2) * 10) / 10;
    labelVi = 'Giảm nhanh';
  } else if (s.pressureTrendCategory === 'FALLING') {
    deltaHpa = -1.6 + Math.round((Math.sin(tick) * 0.2) * 10) / 10;
    labelVi = 'Đang giảm';
  } else {
    deltaHpa = 0.1 + Math.round((Math.sin(tick) * 0.1) * 10) / 10;
    labelVi = 'Ổn định';
  }

  return {
    temperature,
    humidity,
    pressure,
    pressureTrend: {
      category: s.pressureTrendCategory,
      deltaHpa,
      labelVi
    },
    scoreJitter: scoreNoise
  };
}

export interface DemoChartPoint {
  time: string;
  fullTime: string;
  timestamp: string;
  temperature: number;
  humidity: number;
  pressure: number;
  dewPoint: number;
}

function calculateDewPoint(temperature: number, humidity: number): number {
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * temperature) / (b + temperature)) + Math.log(Math.max(humidity, 1) / 100);
  const dewPoint = (b * alpha) / (a - alpha);
  return Math.round(dewPoint * 10) / 10;
}

export function generateDemoChartSeries(params: {
  scenarioId: DemoScenarioId;
  timeRange: string;
  currentEnv: DemoEnvironmentData;
  baseSeries?: any[];
}): DemoChartPoint[] {
  const { scenarioId, timeRange, currentEnv, baseSeries } = params;
  const s = DEMO_SCENARIOS[scenarioId] || DEMO_SCENARIOS.low;

  // 1. Determine time points
  let timePoints: { timestamp: string; time: string; fullTime: string }[] = [];

  if (baseSeries && baseSeries.length >= 8) {
    timePoints = baseSeries.map((m: any) => ({
      timestamp: m.timestamp,
      time: formatTimeVi(m.timestamp),
      fullTime: formatDateTimeVi(m.timestamp)
    }));
  } else {
    const rangeMs: Record<string, number> = {
      '1h': 3600 * 1000,
      '6h': 6 * 3600 * 1000,
      '24h': 24 * 3600 * 1000,
      '7d': 7 * 86400 * 1000,
      '30d': 30 * 86400 * 1000
    };
    const totalMs = rangeMs[timeRange] || (24 * 3600 * 1000);
    const countMap: Record<string, number> = {
      '1h': 24,
      '6h': 36,
      '24h': 48,
      '7d': 42,
      '30d': 60
    };
    const count = countMap[timeRange] || 48;
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 1;
      const ms = now - totalMs * (1 - t);
      const iso = new Date(ms).toISOString();
      timePoints.push({
        timestamp: iso,
        time: formatTimeVi(iso),
        fullTime: formatDateTimeVi(iso)
      });
    }
  }

  const N = timePoints.length;
  if (N === 0) return [];

  const targetTemp = currentEnv.temperature;
  const targetHum = currentEnv.humidity;
  const targetPress = currentEnv.pressure;

  const startTemp = s.startTemp;
  const startHum = s.startHumidity;
  const startPress = s.startPressure;

  return timePoints.map((tp, i) => {
    // Progress from 0 (oldest) to 1 (newest / now)
    const t = N > 1 ? i / (N - 1) : 1;

    // At the newest point (t = 1), match currentEnv exactly
    if (i === N - 1) {
      return {
        ...tp,
        temperature: targetTemp,
        humidity: targetHum,
        pressure: targetPress,
        dewPoint: calculateDewPoint(targetTemp, targetHum)
      };
    }

    // Smooth transition curve: easing power
    const tempProgress = Math.pow(t, 1.3);
    const humProgress = Math.pow(t, 1.2);
    const pressProgress = Math.pow(t, 1.4);

    // Fade noise amplitude to 0 as t approaches 1
    const dampening = 1 - Math.pow(t, 1.4);

    // Natural meteorological oscillation waves
    const waveT = (Math.sin(t * 14 + 1.2) * 0.35 + Math.cos(t * 22) * 0.15) * dampening;
    const waveH = (Math.cos(t * 11 + 0.5) * 0.8 + Math.sin(t * 19) * 0.4) * dampening;
    const waveP = (Math.sin(t * 12 + 0.8) * 0.4 + Math.cos(t * 18) * 0.2) * dampening;

    const baseT = startTemp + (targetTemp - startTemp) * tempProgress;
    const baseH = startHum + (targetHum - startHum) * humProgress;
    const baseP = startPress + (targetPress - startPress) * pressProgress;

    const pointTemp = Math.round((baseT + waveT) * 10) / 10;
    const pointHum = Math.min(99.9, Math.max(20, Math.round((baseH + waveH) * 10) / 10));
    const pointPress = Math.round((baseP + waveP) * 10) / 10;

    return {
      ...tp,
      temperature: pointTemp,
      humidity: pointHum,
      pressure: pointPress,
      dewPoint: calculateDewPoint(pointTemp, pointHum)
    };
  });
}
