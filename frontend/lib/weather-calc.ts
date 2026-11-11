/**
 * Environmental and Rainfall Calculation Utilities
 */

/**
 * Calculate Dew Point in °C using the Magnus-Tetens formula
 * @param temperature Temperature in °C
 * @param humidity Relative humidity in % (0 - 100)
 * @returns Dew point in °C rounded to 1 decimal place
 */
export function calculateDewPoint(temperature: number, humidity: number): number {
  if (humidity <= 0) return temperature;
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * temperature) / (b + temperature) + Math.log(humidity / 100);
  const dewPoint = (b * alpha) / (a - alpha);
  return Math.round(dewPoint * 10) / 10;
}

/**
 * Calculate Heat Index in °C (Rothfusz equation)
 * @param temperature Temperature in °C
 * @param humidity Relative humidity in %
 */
export function calculateHeatIndex(temperature: number, humidity: number): number {
  if (temperature < 26.7 || humidity < 40) {
    return Math.round(temperature * 10) / 10;
  }
  // Convert °C to °F
  const T = (temperature * 9) / 5 + 32;
  const R = humidity;

  let hi =
    -42.379 +
    2.04901523 * T +
    10.14333127 * R -
    0.22475541 * T * R -
    0.00683783 * T * T -
    0.05481717 * R * R +
    0.00122874 * T * T * R +
    0.00085282 * T * R * R -
    0.00000199 * T * T * R * R;

  // Convert back to °C
  const heatIndexC = ((hi - 32) * 5) / 9;
  return Math.round(heatIndexC * 10) / 10;
}

/**
 * Calculate Rainfall Accumulation in mm
 * Formula: Rainfall (mm) = Valid Tips * Calibration Factor (mm/tip)
 */
export function calculateRainfall(tips: number, mmPerTip: number): number {
  if (tips <= 0 || mmPerTip <= 0) return 0;
  return Math.round(tips * mmPerTip * 100) / 100;
}

/**
 * Calculate Rain Rate (Intensity) in mm/h over a specific time window
 * Formula: Rain Rate (mm/h) = Rainfall in window (mm) / Window duration (hours)
 * @param rainfallMm Accumulated rain in window
 * @param windowMinutes Window duration in minutes (e.g. 5, 15, 60)
 */
export function calculateRainRate(rainfallMm: number, windowMinutes: number): number {
  if (windowMinutes <= 0 || rainfallMm <= 0) return 0;
  const hours = windowMinutes / 60;
  const rate = rainfallMm / hours;
  return Math.round(rate * 10) / 10;
}

/**
 * Calculate Sea Level Pressure (hPa) given station elevation
 * Formula: P0 = P * (1 - (0.0065 * h) / (T + 0.0065 * h + 273.15)) ^ -5.257
 * @param stationPressure Measured atmospheric pressure in hPa
 * @param elevationMeters Altitude above sea level in meters
 * @param temperature Temperature in °C
 */
export function calculateSeaLevelPressure(
  stationPressure: number,
  elevationMeters: number,
  temperature: number
): number {
  if (elevationMeters <= 0) return stationPressure;
  const factor = 1 - (0.0065 * elevationMeters) / (temperature + 0.0065 * elevationMeters + 273.15);
  const p0 = stationPressure * Math.pow(factor, -5.257);
  return Math.round(p0 * 10) / 10;
}

export type PressureTrendCategory = 'UNKNOWN' | 'RAPIDLY_RISING' | 'RISING' | 'STABLE' | 'FALLING' | 'RAPIDLY_FALLING';

export interface PressureTrendResult {
  category: PressureTrendCategory;
  deltaHpa: number | null;
  labelVi: string;
}

/**
 * Analyze Atmospheric Pressure Trend over a 3-hour window
 * @param currentPressure Current pressure in hPa
 * @param pastPressure Pressure 3 hours ago in hPa
 */
export function classifyPressureTrend(currentPressure: number, pastPressure?: number): PressureTrendResult {
  if (!Number.isFinite(currentPressure) || pastPressure === undefined || pastPressure === null || !Number.isFinite(pastPressure)) {
    return { category: 'UNKNOWN', deltaHpa: null, labelVi: 'Chưa đủ dữ liệu' };
  }
  const delta = Math.round((currentPressure - pastPressure) * 10) / 10;

  if (delta >= 3.0) {
    return { category: 'RAPIDLY_RISING', deltaHpa: delta, labelVi: 'Tăng nhanh' };
  } else if (delta >= 1.2) {
    return { category: 'RISING', deltaHpa: delta, labelVi: 'Đang tăng' };
  } else if (delta <= -3.0) {
    return { category: 'RAPIDLY_FALLING', deltaHpa: delta, labelVi: 'Giảm nhanh' };
  } else if (delta <= -1.2) {
    return { category: 'FALLING', deltaHpa: delta, labelVi: 'Đang giảm' };
  } else {
    return { category: 'STABLE', deltaHpa: delta, labelVi: 'Ổn định' };
  }
}

/**
 * Get human-readable description for humidity level in Vietnamese
 */
export function getHumidityStatusVi(humidity: number): { label: string; color: string } {
  if (humidity < 30) return { label: 'Khô hanh', color: 'text-amber-500' };
  if (humidity <= 65) return { label: 'Lý tưởng', color: 'text-emerald-500' };
  if (humidity <= 80) return { label: 'Độ ẩm cao', color: 'text-blue-400' };
  return { label: 'Rất ẩm ướt', color: 'text-blue-600' };
}

/**
 * Categorize rainfall intensity according to meteorological standards (Vietnam / WMO)
 * - Nhẹ (Light): < 2.5 mm/h
 * - Vừa (Moderate): 2.5 - 10 mm/h
 * - To (Heavy): 10 - 50 mm/h
 * - Rất to (Violent / Torrential): > 50 mm/h
 */
export function getRainRateCategoryVi(rateMmH: number): {
  level: 'NONE' | 'LIGHT' | 'MODERATE' | 'HEAVY' | 'VIOLENT';
  labelVi: string;
  badgeVariant: 'secondary' | 'default' | 'warning' | 'destructive';
} {
  if (rateMmH <= 0.05) {
    return { level: 'NONE', labelVi: 'Không mưa', badgeVariant: 'secondary' };
  } else if (rateMmH < 2.5) {
    return { level: 'LIGHT', labelVi: 'Mưa nhỏ', badgeVariant: 'secondary' };
  } else if (rateMmH < 10) {
    return { level: 'MODERATE', labelVi: 'Mưa vừa', badgeVariant: 'default' };
  } else if (rateMmH < 50) {
    return { level: 'HEAVY', labelVi: 'Mưa to', badgeVariant: 'warning' };
  } else {
    return { level: 'VIOLENT', labelVi: 'Mưa rất to', badgeVariant: 'destructive' };
  }
}


export interface FloodRiskFactor {
  name: string;
  value: string;
  status: 'SAFE' | 'MONITOR' | 'WARNING' | 'ALERT';
  statusVi: string;
  impact: string;
  color: string;
}

export interface FloodRiskAssessment {
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  levelVi: string;
  score: number;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  trend: 'STABLE' | 'RISING' | 'FALLING';
  trendVi: string;
  trendIcon: 'stable' | 'rising' | 'falling';
  summary: string;
  factors: FloodRiskFactor[];
  aiExplanation: string;
  actionRecommendation: string;
}

export function calculateFloodRisk(params: {
  rainRate?: number | null;
  todayMm?: number | null;
  rolling24hMm?: number | null;
  humidity?: number | null;
  pressure?: number | null;
  pressureTrendCategory?: string | null;
}): FloodRiskAssessment {
  const rainRate = params.rainRate ?? 0;
  const todayMm = params.todayMm ?? 0;
  const rolling24hMm = params.rolling24hMm ?? todayMm;
  const humidity = params.humidity ?? 60;
  const pressure = params.pressure ?? 1013;
  const pressureTrend = params.pressureTrendCategory ?? 'STABLE';

  let score = 0;

  // 1. Cường độ mưa (max 45 điểm)
  if (rainRate > 50) score += 45;
  else if (rainRate > 25) score += 35;
  else if (rainRate > 10) score += 25;
  else if (rainRate > 2.5) score += 12;
  else if (rainRate > 0) score += 5;

  // 2. Lượng mưa tích lũy 24h / hôm nay (max 35 điểm)
  if (rolling24hMm > 100) score += 35;
  else if (rolling24hMm > 60) score += 28;
  else if (rolling24hMm > 30) score += 18;
  else if (rolling24hMm > 10) score += 8;
  else if (rolling24hMm > 2) score += 3;

  // 3. Độ ẩm không khí (max 10 điểm - đất bão hòa / bốc hơi chậm)
  if (humidity > 85) score += 10;
  else if (humidity > 75) score += 6;
  else if (humidity > 65) score += 3;

  // 4. Áp suất khí quyển giảm nhanh / giông bão (max 10 điểm)
  if (pressureTrend === 'RAPIDLY_FALLING' || pressure < 1000) score += 10;
  else if (pressureTrend === 'FALLING' || pressure < 1005) score += 6;

  score = Math.min(Math.max(score, 0), 100);

  // Xu hướng nguy cơ
  let trend: 'STABLE' | 'RISING' | 'FALLING' = 'STABLE';
  let trendVi = 'Ổn định';
  let trendIcon: 'stable' | 'rising' | 'falling' = 'stable';

  if (rainRate >= 5 || pressureTrend === 'RAPIDLY_FALLING' || (rainRate > 0 && rolling24hMm > 20)) {
    trend = 'RISING';
    trendVi = 'Đang có xu hướng tăng';
    trendIcon = 'rising';
  } else if (rainRate === 0 && rolling24hMm > 0) {
    trend = 'FALLING';
    trendVi = 'Đang giảm dần (nước rút)';
    trendIcon = 'falling';
  } else {
    trend = 'STABLE';
    trendVi = 'Ổn định (mức thấp)';
    trendIcon = 'stable';
  }

  // Xác định Level
  let level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
  let levelVi = 'Thấp';
  let color = 'emerald';
  let bgClass = 'bg-emerald-500/10';
  let borderClass = 'border-emerald-500/30';
  let textClass = 'text-emerald-600 dark:text-emerald-400';
  let summary = 'Thoát nước an toàn';

  if (score >= 75) {
    level = 'CRITICAL';
    levelVi = 'Rất cao';
    color = 'rose';
    bgClass = 'bg-rose-500/15';
    borderClass = 'border-rose-500/40';
    textClass = 'text-rose-600 dark:text-rose-400';
    summary = 'Cảnh báo ngập sâu cục bộ';
  } else if (score >= 50) {
    level = 'HIGH';
    levelVi = 'Cao';
    color = 'orange';
    bgClass = 'bg-orange-500/15';
    borderClass = 'border-orange-500/30';
    textClass = 'text-orange-600 dark:text-orange-400';
    summary = 'Nguy cơ ngập ở điểm trũng';
  } else if (score >= 25) {
    level = 'MODERATE';
    levelVi = 'Trung bình';
    color = 'amber';
    bgClass = 'bg-amber-500/15';
    borderClass = 'border-amber-500/30';
    textClass = 'text-amber-600 dark:text-amber-400';
    summary = 'Cần chú ý cống thoát chậm';
  }

  const factors: FloodRiskFactor[] = [
    {
      name: 'Cường độ mưa tức thời (5 phút)',
      value: `${rainRate.toFixed(1)} mm/h`,
      status: rainRate >= 25 ? 'ALERT' : rainRate >= 10 ? 'WARNING' : rainRate >= 2.5 ? 'MONITOR' : 'SAFE',
      statusVi: rainRate >= 25 ? 'Rất to' : rainRate >= 10 ? 'Mưa to' : rainRate >= 2.5 ? 'Mưa vừa' : 'Không mưa / Nhỏ',
      impact: rainRate >= 25 ? 'Lưu lượng nước dồn dập vượt khả năng thấm' : rainRate >= 10 ? 'Tạo dòng chảy tràn mặt đất' : 'Hệ thống rãnh gom tự nhiên đáp ứng tốt',
      color: rainRate >= 25 ? 'text-rose-500' : rainRate >= 10 ? 'text-orange-500' : rainRate >= 2.5 ? 'text-amber-500' : 'text-emerald-500'
    },
    {
      name: 'Lượng mưa tích lũy 24 giờ',
      value: `${rolling24hMm.toFixed(2)} mm`,
      status: rolling24hMm >= 60 ? 'ALERT' : rolling24hMm >= 30 ? 'WARNING' : rolling24hMm >= 10 ? 'MONITOR' : 'SAFE',
      statusVi: rolling24hMm >= 60 ? 'Rất lớn' : rolling24hMm >= 30 ? 'Đáng kể' : rolling24hMm >= 10 ? 'Vừa phải' : 'Thấp',
      impact: rolling24hMm >= 60 ? 'Đất đã bão hòa hoàn toàn, nước không thể ngấm' : rolling24hMm >= 30 ? 'Giảm dung tích đệm chứa của đất' : 'Đất còn khả năng ngấm nước tốt',
      color: rolling24hMm >= 60 ? 'text-rose-500' : rolling24hMm >= 30 ? 'text-orange-500' : rolling24hMm >= 10 ? 'text-amber-500' : 'text-emerald-500'
    },
    {
      name: 'Độ ẩm không khí (DHT11)',
      value: `${humidity.toFixed(1)} %`,
      status: humidity >= 85 ? 'WARNING' : humidity >= 70 ? 'MONITOR' : 'SAFE',
      statusVi: humidity >= 85 ? 'Bão hòa ẩm' : humidity >= 70 ? 'Độ ẩm cao' : 'Bình thường',
      impact: humidity >= 85 ? 'Hạn chế tối đa tốc độ bốc hơi tự nhiên' : 'Tốc độ bốc hơi trung bình',
      color: humidity >= 85 ? 'text-orange-500' : humidity >= 70 ? 'text-blue-400' : 'text-emerald-500'
    },
    {
      name: 'Áp suất khí quyển (BMP180)',
      value: `${pressure.toFixed(1)} hPa`,
      status: pressureTrend === 'RAPIDLY_FALLING' ? 'ALERT' : pressureTrend === 'FALLING' ? 'WARNING' : 'SAFE',
      statusVi: pressureTrend === 'RAPIDLY_FALLING' ? 'Giảm nhanh (>3 hPa/3h)' : pressureTrend === 'FALLING' ? 'Đang giảm' : 'Ổn định',
      impact: pressureTrend.includes('FALLING') ? 'Cảnh báo xoáy thuận/giông bão kèm mưa lớn tiếp diễn' : 'Thời tiết ổn định, không có nhiễu động khí áp',
      color: pressureTrend.includes('FALLING') ? 'text-purple-400' : 'text-emerald-500'
    }
  ];

  let aiExplanation = '';
  let actionRecommendation = '';

  if (level === 'CRITICAL') {
    aiExplanation = `Mô hình AI ghi nhận tổng lượng mưa ${rolling24hMm.toFixed(1)} mm kết hợp cường độ mưa tức thời đạt ${rainRate.toFixed(1)} mm/h và độ ẩm không khí bão hòa (${humidity.toFixed(1)}%). Với lưu lượng mưa tập trung cao và áp suất khí quyển ${pressure.toFixed(1)} hPa, hệ số bão hòa đất đạt đỉnh, khả năng tự tiêu thoát của khu vực bị quá tải nghiêm trọng.`;
    actionRecommendation = 'Cảnh báo khẩn: Chủ động kê cao đồ đạc, di dời phương tiện khỏi hầm/vùng trũng thấp. Tuyệt đối không cố gắng lội qua các đoạn đường ngập sâu hoặc dòng nước chảy xiết.';
  } else if (level === 'HIGH') {
    aiExplanation = `Lượng mưa tích lũy (${rolling24hMm.toFixed(1)} mm) và cường độ mưa ${rainRate.toFixed(1)} mm/h đang tạo ra áp lực đáng kể lên hệ thống thu gom nước mặt. Độ ẩm không khí cao (${humidity.toFixed(1)}%) cho thấy mặt đất đã ẩm ướt kéo dài, nguy cơ ứ đọng nước cục bộ ở các hố trũng và lòng đường đang gia tăng.`;
    actionRecommendation = 'Khuyến cáo: Chú ý quan sát khi lưu thông qua các tuyến phố trũng thấp; kiểm tra khơi thông nắp cống xung quanh khu vực sinh sống.';
  } else if (level === 'MODERATE') {
    aiExplanation = `Trạm ghi nhận lượng mưa ở mức trung bình (${rolling24hMm.toFixed(1)} mm) với cường độ ${rainRate.toFixed(1)} mm/h. Tốc độ ngấm nước của đất và khả năng thoát nước của hạ tầng vẫn đang duy trì tải trọng, chưa xuất hiện ngập úng nghiêm trọng trên diện rộng.`;
    actionRecommendation = 'Tiếp tục theo dõi diễn biến lượng mưa và xu hướng biến thiên khí áp từ cảm biến BMP180 trong các giờ tiếp theo.';
  } else {
    aiExplanation = `Chỉ số ngập lụt hiện tại ở mức THẤP (${score}%). Lượng mưa hôm nay (${todayMm.toFixed(2)} mm) và cường độ mưa tức thời (${rainRate.toFixed(1)} mm/h) hoàn toàn nằm trong ngưỡng an toàn tuyệt đối của hệ thống thoát nước tự nhiên và đô thị.`;
    actionRecommendation = 'Hiện trạng an toàn, không có nguy cơ ngập úng. Hệ thống cảm biến RainSense tiếp tục túc trực giám sát thời gian thực.';
  }

  return {
    level,
    levelVi,
    score,
    color,
    bgClass,
    borderClass,
    textClass,
    trend,
    trendVi,
    trendIcon,
    summary,
    factors,
    aiExplanation,
    actionRecommendation
  };
}
