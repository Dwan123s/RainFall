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
  baseRainRate: number; // mm/h
  baseTodayRain: number; // mm
  base24hRain: number; // mm
  baseTips: number;
}

export const DEMO_SCENARIOS: Record<DemoScenarioId, DemoScenarioConfig> = {
  low: {
    id: 'low',
    code: 'Demo 1',
    name: 'Nguy cơ Thấp (An toàn)',
    badgeLabel: 'Demo 1: Thấp',
    shortLabel: 'Thấp',
    description: 'Trời tạnh ráo, không mưa, cống rãnh lưu thông tốt, nguy cơ ngập lụt ở mức tối thiểu.',
    baseTemp: 29.4,
    baseHumidity: 62.5,
    basePressure: 1013.8,
    pressureTrendCategory: 'STABLE',
    baseRainRate: 0.0,
    baseTodayRain: 1.28,
    base24hRain: 1.28,
    baseTips: 2
  },
  moderate: {
    id: 'moderate',
    code: 'Demo 2',
    name: 'Nguy cơ Trung bình (Cần lưu ý)',
    badgeLabel: 'Demo 2: Trung bình',
    shortLabel: 'Trung bình',
    description: 'Mưa rào nhẹ đến vừa, đất bắt đầu ẩm ướt, nước bắt đầu tích tụ tại các điểm trũng thấp và cống thoát chậm.',
    baseTemp: 26.8,
    baseHumidity: 78.5,
    basePressure: 1008.2,
    pressureTrendCategory: 'FALLING',
    baseRainRate: 14.5,
    baseTodayRain: 26.88,
    base24hRain: 28.50,
    baseTips: 42
  },
  high: {
    id: 'high',
    code: 'Demo 3',
    name: 'Nguy cơ Cao (Cảnh báo ngập)',
    badgeLabel: 'Demo 3: Cao',
    shortLabel: 'Cao',
    description: 'Mưa to kéo dài liên tục, áp suất khí quyển giảm mạnh, đất ngậm no nước, nguy cơ ngập sâu 15-30cm.',
    baseTemp: 24.6,
    baseHumidity: 88.6,
    basePressure: 1003.4,
    pressureTrendCategory: 'RAPIDLY_FALLING',
    baseRainRate: 32.5,
    baseTodayRain: 64.00,
    base24hRain: 68.40,
    baseTips: 100
  },
  critical: {
    id: 'critical',
    code: 'Demo 4',
    name: 'Nguy cơ Rất cao (Nguy hiểm)',
    badgeLabel: 'Demo 4: Rất cao',
    shortLabel: 'Rất cao',
    description: 'Mưa xối xả dồn dập, khí áp tụt sâu do bão/xoáy thuận nhiệt đới, đất bão hòa đỉnh điểm, cảnh báo ngập sâu diện rộng.',
    baseTemp: 23.2,
    baseHumidity: 94.6,
    basePressure: 998.2,
    pressureTrendCategory: 'RAPIDLY_FALLING',
    baseRainRate: 58.5,
    baseTodayRain: 115.20,
    base24hRain: 122.80,
    baseTips: 180
  }
};

export function generateDemoTelemetry(scenarioId: DemoScenarioId, tick: number) {
  const s = DEMO_SCENARIOS[scenarioId] || DEMO_SCENARIOS.low;

  // Gentle, realistic wave + subtle noise (không tăng giảm quá nhiều)
  // Max variation: temp ±0.2°C, hum ±0.5%, press ±0.2 hPa, rainRate ±0.6 mm/h
  const tempNoise = Math.round((Math.sin(tick * 0.4) * 0.15 + Math.sin(tick * 1.3) * 0.05) * 10) / 10;
  const humNoise = Math.round((Math.cos(tick * 0.3) * 0.4 + Math.sin(tick * 0.9) * 0.15) * 10) / 10;
  const pressNoise = Math.round((Math.sin(tick * 0.25) * 0.2 + Math.cos(tick * 0.7) * 0.05) * 10) / 10;

  // Rain rate noise
  const rateNoise = s.baseRainRate > 0
    ? Math.round((Math.sin(tick * 0.5) * 0.6 + Math.cos(tick * 1.1) * 0.2) * 10) / 10
    : (tick % 7 === 0 ? 0.1 : 0.0);

  const temperature = Math.round((s.baseTemp + tempNoise) * 10) / 10;
  const humidity = Math.min(99.9, Math.max(20, Math.round((s.baseHumidity + humNoise) * 10) / 10));
  const pressure = Math.round((s.basePressure + pressNoise) * 10) / 10;
  const rainRate = Math.max(0, Math.round((s.baseRainRate + rateNoise) * 10) / 10);

  // Every 8 ticks (~20s), if it's raining, increment tips by 1
  const extraTips = s.baseRainRate > 0 ? Math.floor(tick / 8) : 0;
  const totalRainTips = s.baseTips + extraTips;
  const todayMm = Math.round((s.baseTodayRain + extraTips * 0.64) * 100) / 100;
  const rolling24hMm = Math.round((s.base24hRain + extraTips * 0.64) * 100) / 100;

  const nowIso = new Date().toISOString();

  const measurement = {
    deviceId: 'RS-ESP32S3-01',
    messageId: `demo-sim-${Date.now()}-${tick}`,
    timestamp: nowIso,
    temperature,
    humidity,
    pressure,
    wifiRssi: -62 + (tick % 3),
    uptime: 180000 + tick * 3,
    totalRainTips,
    rainRate
  };

  const rainfall = {
    todayMm,
    yesterdayMm: 0.0,
    rolling24hMm,
    last1hMm: Math.round(rainRate * 0.8 * 10) / 10,
    last3hMm: Math.round(rainRate * 1.6 * 10) / 10,
    last6hMm: Math.round(rainRate * 2.1 * 10) / 10,
    last7DaysMm: Math.round((97.92 + todayMm) * 100) / 100,
    currentMonthMm: Math.round((97.92 + todayMm) * 100) / 100,
    lifetimeMm: Math.round((97.92 + todayMm) * 100) / 100,
    lifetimeTips: 153 + totalRainTips,
    currentRateMmH: rainRate,
    maxObservedRateMmH: Math.max(s.baseRainRate + 5, 476.2),
    timeOfMaxRate: nowIso,
    totalTipsToday: totalRainTips,
    calibrationFactor: 0.64,
    lastTipTimestamp: s.baseRainRate > 0 ? nowIso : '2026-11-09T08:46:51.000Z'
  };

  const dashboardSummary = {
    device: {
      deviceId: 'RS-ESP32S3-01',
      name: 'Trạm Quan Trắc ESP32-S3 (Mô Phỏng Demo)',
      location: 'Phòng Thí Nghiệm IoT — Demo Mode',
      latitude: 10.7769,
      longitude: 106.7009,
      elevationM: 10,
      isOnline: true,
      lastSeen: nowIso,
      firmwareVersion: 'v2.1.0-demo',
      wifiRssi: -62,
      timezone: 'Asia/Ho_Chi_Minh'
    },
    latestMeasurement: measurement,
    rainfall,
    systemHealth: {
      bme280Status: 'OK' as const,
      rainGaugeStatus: 'OK' as const,
      mqttStatus: 'CONNECTED' as const,
      backendStatus: 'HEALTHY' as const,
      lastSeenSecondsAgo: 1,
      hasReceivedData: true,
      isStale: false
    },
    recentAlerts: [],
    activeAlertCount: 0,
    mode: 'DEMO' as const
  };

  return { measurement, rainfall, dashboardSummary };
}
