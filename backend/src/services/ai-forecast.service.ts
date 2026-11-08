import { env } from '../config/env';
import type { ForecastContext, ForecastPeriod, StationProfile } from '../shared/ai-types';
import type { StationContext } from '../shared/rainsense-ai';
import { getStartOfDayInTimezone } from '../shared/utils/time';
import { normalizeTimePhrase, hasFutureTime, parseTimeDuration } from '../shared/time-request';
import { wantsDetailedAnswer } from '../shared/answer-style';
import { observationMetrics } from '../shared/observation-request';

const HOUR = 3600000;
const TTL = 10 * 60000;
const SOURCE = 'https://open-meteo.com/';

export function isForecastQuery(query: string): boolean {
  const q = normalizeTimePhrase(query);
  if (/la gi|nguyen ly|cach (?:xay|train|du bao)|huan luyen|hoat dong|hieu chuan/.test(q)) return false;
  if (!/du bao/.test(q) && !hasFutureTime(q) && /hien tai|luc nay|bay gio|dang.*mua|hom qua|vua qua|gan nhat/.test(q)) return false;
  return hasFutureTime(q) || /du bao|se mua|mua khong|khi nao.*mua|bao gio.*mua|xac suat.*mua/.test(q);
}

export function forecastWindow(query: string, timezone: string, now: Date) {
  const q = normalizeTimePhrase(query);
  const start = getStartOfDayInTimezone(now, timezone).getTime();
  let from = now.getTime();
  let to = from + 6 * HOUR;
  const tomorrow = /mai/.test(q);
  const dayAfter = /ngay kia/.test(q);
  const part = /\bsang\b/.test(q) ? [6, 12] : /chieu/.test(q) ? [12, 18] : /toi nay|toi mai|buoi toi|toi ngay/.test(q) ? [18, 24] : null;
  if (tomorrow || dayAfter || /hom nay|toi nay/.test(q) || part) {
    const day = start + (dayAfter ? 48 : tomorrow ? 24 : 0) * HOUR;
    from = Math.max(now.getTime(), day + (part?.[0] ?? 0) * HOUR);
    to = day + (part?.[1] ?? 24) * HOUR;
  }
  const duration = parseTimeDuration(q);
  if (duration.status === 'ready') to = from + duration.milliseconds;
  // Do not answer a named date/week using the default six-hour forecast.
  const unsupported = /tuan|thang|cuoi tuan|hom qua|hom kia|qua khu|ngay\s*\d|\d{1,2}[/-]\d{1,2}|luc\s*\d|\d+\s*ngay\s*toi|(?:sau|trong)\s*\d+\s*ngay|thu (?:hai|ba|tu|nam|sau|bay)|chu nhat/.test(q) || duration.status === 'invalid' || duration.status === 'ready' && (duration.milliseconds % HOUR !== 0 || /hom nay|toi nay|mai|ngay kia|buoi|\bsang\b|chieu/.test(q)) || !Number.isFinite(to) || to <= from || to - now.getTime() > 72 * HOUR;
  if (!Number.isFinite(to) || Math.abs(to) > 8640000000000000) to = now.getTime() + 6 * HOUR;
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString(), unsupported };
}

const numberIn = (value: unknown, low: number, high: number): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high ? value : null;

export class ForecastService {
  private cache = new Map<string, { fetchedAt: number; latitude: number; longitude: number; periods: ForecastPeriod[] }>();

  async getForecast(query: string, profile: StationProfile, timezone: string, now = new Date()): Promise<ForecastContext> {
    const window = forecastWindow(query, timezone, now);
    const base: ForecastContext = {
      status: 'unavailable', provider: 'Open-Meteo', sourceUrl: SOURCE, fetchedAt: null, issuedAt: null, expiresAt: null,
      requestedFrom: window.from, requestedTo: window.to, latitude: profile.latitude ?? null, longitude: profile.longitude ?? null, periods: []
    };
    if (!env.AI_FORECAST_ENABLED) return { ...base, status: 'disabled' };
    if (profile.latitude === undefined || profile.longitude === undefined) return { ...base, status: 'missing_location' };
    if (!Number.isFinite(profile.latitude) || !Number.isFinite(profile.longitude) || Math.abs(profile.latitude) > 90 || Math.abs(profile.longitude) > 180) return base;
    if (window.unsupported) return { ...base, status: 'unsupported_range' };
    const key = `${profile.latitude},${profile.longitude},${profile.elevationMeters ?? 'auto'}`;
    let cached = this.cache.get(key);
    if (!cached || now.getTime() < cached.fetchedAt || now.getTime() - cached.fetchedAt >= TTL) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      try {
        const endpoint = env.OPEN_METEO_API_KEY ? 'https://customer-api.open-meteo.com/v1/forecast' : 'https://api.open-meteo.com/v1/forecast';
        const url = new URL(endpoint);
        url.searchParams.set('latitude', String(profile.latitude));
        url.searchParams.set('longitude', String(profile.longitude));
        url.searchParams.set('hourly', 'temperature_2m,relative_humidity_2m,surface_pressure,precipitation,precipitation_probability');
        url.searchParams.set('forecast_days', '4');
        url.searchParams.set('timezone', 'GMT');
        url.searchParams.set('timeformat', 'unixtime');
        if (profile.elevationMeters !== undefined) url.searchParams.set('elevation', String(profile.elevationMeters));
        if (env.OPEN_METEO_API_KEY) url.searchParams.set('apikey', env.OPEN_METEO_API_KEY);
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return base;
        const data = await response.json();
        const hourly = data?.hourly;
        const units = data?.hourly_units;
        if (!Array.isArray(hourly?.time) || hourly.time.length > 120 || units?.time !== 'unixtime' || units?.temperature_2m !== '°C' ||
          units?.relative_humidity_2m !== '%' || units?.precipitation !== 'mm' || units?.precipitation_probability !== '%') return base;
        for (const field of ['temperature_2m', 'relative_humidity_2m', 'precipitation', 'precipitation_probability']) {
          if (!Array.isArray(hourly[field]) || hourly[field].length !== hourly.time.length) return base;
        }
        if (hourly.surface_pressure !== undefined && (!Array.isArray(hourly.surface_pressure) || hourly.surface_pressure.length !== hourly.time.length || units.surface_pressure !== 'hPa')) return base;
        const periods: ForecastPeriod[] = [];
        for (let i = 0; i < hourly.time.length; i++) {
          const stamp = hourly.time[i];
          if (!Number.isSafeInteger(stamp) || Math.abs(stamp * 1000 - now.getTime()) > 6 * 24 * HOUR || (i > 0 && stamp !== hourly.time[i - 1] + 3600)) return base;
          periods.push({ from: new Date(stamp * 1000 - HOUR).toISOString(), to: new Date(stamp * 1000).toISOString(),
            temperatureC: numberIn(hourly.temperature_2m[i], -100, 70),
            humidityPercent: numberIn(hourly.relative_humidity_2m[i], 0, 100),
            pressureHpa: numberIn(hourly.surface_pressure?.[i], 100, 1100),
            precipitationMm: numberIn(hourly.precipitation[i], 0, 1000),
            precipitationProbabilityPercent: numberIn(hourly.precipitation_probability[i], 0, 100) });
        }
        cached = { fetchedAt: now.getTime(), latitude: profile.latitude, longitude: profile.longitude, periods };
        if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, cached);
      } catch { return base; }
      finally { clearTimeout(timer); }
    }
    const from = Date.parse(window.from);
    const to = Date.parse(window.to);
    const periods = cached.periods.filter((p) => Date.parse(p.from) >= from && Date.parse(p.to) <= to);
    if (!periods.length || periods.every((p) => p.temperatureC === null && p.humidityPercent === null && p.pressureHpa == null && p.precipitationMm === null && p.precipitationProbabilityPercent === null)) return base;
    return { ...base, status: 'available', periods, fetchedAt: new Date(cached.fetchedAt).toISOString(), expiresAt: new Date(cached.fetchedAt + TTL).toISOString() };
  }
}

export function forecastReply(f: ForecastContext, c: StationContext, query = ''): string {
  if (f.status === 'missing_location') return `Trạm ${c.stationName} (${c.deviceId}) chưa có tọa độ được cấu hình nên chưa thể lấy dự báo đúng vị trí. Repository chỉ ghi “Trạm thực địa ESP32-S3”; múi giờ không xác định vị trí trạm. Cần bổ sung vĩ độ và kinh độ trong hồ sơ trạm. Không thể suy ra giờ mưa hoặc xác suất từ một vài số đo hiện có.`;
  if (f.status === 'disabled') return 'Dịch vụ dự báo chưa được bật cho hệ thống. Có thể phân tích số đo đã ghi nhận, nhưng chưa có nguồn để đưa ra giờ mưa hoặc xác suất tương lai.';
  if (f.status === 'unsupported_range') return 'Khoảng dự báo này chưa được hỗ trợ. Hiện có thể hỏi các giờ trọn vẹn trong 6 giờ tới, hôm nay, ngày mai hoặc ngày kia (tối đa 72 giờ); chưa thể trả lời đúng mốc ngày/giờ cụ thể từ câu hỏi này.';
  if (f.status !== 'available') return 'Hiện chưa lấy được bản dự báo hợp lệ cho trạm. Có thể nguồn đang gián đoạn hoặc chưa có dữ liệu cho khoảng được hỏi; mình không thay bằng số đo cũ hay tự tạo xác suất mưa.';
  const time = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: c.timezone, hour12: false });
  const detailed = wantsDetailedAnswer(query);
  if (!detailed) return compactForecast(f, c, query, time);
  const requested = observationMetrics(normalizeTimePhrase(query));
  const metrics = requested.length ? requested : ['temperature', 'humidity', 'pressure', 'rain'];
  const ordered = [...f.periods].sort((a, b) => a.from.localeCompare(b.from));
  const selected = metrics.includes('rain') ? [...ordered].sort((a, b) => (b.precipitationProbabilityPercent ?? -1) - (a.precipitationProbabilityPercent ?? -1) || (b.precipitationMm ?? -1) - (a.precipitationMm ?? -1)).slice(0, 3) : ordered.filter((_, i) => i === 0 || i === Math.floor(ordered.length / 2) || i === ordered.length - 1);
  selected.sort((a, b) => a.from.localeCompare(b.from));
  const detail = selected.map((p) => {
    const values: string[] = [];
    if (metrics.includes('temperature')) values.push(p.temperatureC === null ? 'chưa có nhiệt độ' : p.temperatureC + ' °C tại cuối khoảng');
    if (metrics.includes('humidity')) values.push(p.humidityPercent === null ? 'chưa có RH' : 'RH ' + p.humidityPercent + '% tại cuối khoảng');
    if (metrics.includes('pressure')) values.push(p.pressureHpa == null ? 'chưa có khí áp' : 'khí áp bề mặt ' + p.pressureHpa + ' hPa tại cuối khoảng');
    if (metrics.includes('rain')) values.push((p.precipitationMm === null ? 'thiếu lượng giáng thủy' : p.precipitationMm + ' mm trong khoảng') + (p.precipitationProbabilityPercent === null ? ', chưa có xác suất' : ', xác suất ' + p.precipitationProbabilityPercent + '%'));
    return time(p.from) + '–' + time(p.to) + ': ' + values.join(', ') + '.';
  }).join('\n');
  return compactForecast(f, c, query, time) + '\n\nCác mốc tiêu biểu:\n' + detail;
}

function compactForecast(f: ForecastContext, c: StationContext, query: string, time: (iso: string) => string): string {
  const requested = observationMetrics(normalizeTimePhrase(query));
  const metrics = requested.length ? requested : ['temperature', 'humidity', 'pressure', 'rain'];
  const periods = [...f.periods].sort((a, b) => a.from.localeCompare(b.from));
  if (!periods.length) return 'Nguồn chưa cung cấp các giờ dự báo hợp lệ cho khoảng được hỏi.';
  const range = (numbers: Array<number | null | undefined>, unit: string) => {
    const values = numbers.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
    if (!values.length) return 'chưa có dữ liệu';
    const min = Math.min(...values), max = Math.max(...values);
    return `${min}${max === min ? '' : `–${max}`} ${unit}`;
  };
  const lines = [`Open-Meteo dự báo cho trạm ${c.deviceId}: ${time(periods[0].from)}–${time(periods.at(-1)!.to)}, ${periods.length} giờ trọn vẹn trong khoảng bạn hỏi (lấy lúc ${time(f.fetchedAt!)}).`];
  if (metrics.includes('temperature')) lines.push(`Nhiệt độ tại các mốc giờ: ${range(periods.map((p) => p.temperatureC), '°C')}.`);
  if (metrics.includes('humidity')) lines.push(`RH tại các mốc giờ: ${range(periods.map((p) => p.humidityPercent), '%')}.`);
  if (metrics.includes('pressure')) lines.push(`Khí áp bề mặt dự báo: ${range(periods.map((p) => p.pressureHpa), 'hPa')}, khác khí áp quy về mực biển.`);
  if (metrics.includes('rain')) {
    const amounts = periods.map((p) => p.precipitationMm);
    const total = amounts.every((n): n is number => n !== null) ? Math.round(amounts.reduce((a, b) => a + b, 0) * 100) / 100 : null;
    const probability = range(periods.map((p) => p.precipitationProbabilityPercent), '%').replace(' %', '%');
    lines.push(`${total === null ? 'Thiếu lượng giáng thủy một số giờ, chưa tính tổng' : `Tổng giáng thủy dự báo ${total} mm`}; ${probability === 'chưa có dữ liệu' ? 'chưa có xác suất giáng thủy' : `xác suất giáng thủy từng giờ ${probability}`} (cho >0,1 mm), không cộng xác suất giờ thành ngày.`);
  }
  lines.push('Đây là dự báo bên ngoài, không phải số đo gầu lật; chưa bảo đảm giờ bắt đầu mưa chính xác.');
  if (c.dataQuality?.fresh === false || !c.isOnline) lines.push('Quan trắc tại trạm đang cũ/ngoại tuyến, chưa đối chiếu được với hiện tại.');
  return lines.join('\n');
}

export const forecastService = new ForecastService();
