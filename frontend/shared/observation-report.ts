import type { WeatherFeatures } from './ai-types';
import type { RainWindow, StationContext } from './rainsense-ai';
import { foldText } from './project-knowledge';
import { wantsDetailedAnswer } from './answer-style';
import { describeRainWindow, isWaterTestQuery } from './rain-interpretation';
import { temperatureInterpretation, humidityInterpretation, pressureInterpretation } from './metric-interpretation';
export { parseObservationRequest } from './observation-request';

export type ObservationMetric = 'temperature' | 'humidity' | 'pressure' | 'rain';
export interface ObservationRequest { from: string; to: string; label: string; metrics: ObservationMetric[]; includeEnd?: boolean }
export interface ObservationReport extends ObservationRequest {
  generatedAt: string;
  weather: WeatherFeatures;
  rain: RainWindow;
  historyTruncated: boolean;
}
export type ParsedObservation = { status: 'none' } | { status: 'invalid'; message: string } | { status: 'ready'; request: ObservationRequest };


const display = (value: number) => Number(value.toFixed(2)).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export function formatObservationReport(report: ObservationReport, context: StationContext, query: string): string {
  if (!wantsDetailedAnswer(query)) return compactReport(report, context, query);
  const time = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: context.timezone, hour12: false });
  const lines = [`Báo cáo ${report.label} của trạm ${context.stationName} (${context.deviceId}), từ ${time(report.from)} đến ${time(report.to)} (${context.timezone}):`];
  const labels = { temperature: ['Nhiệt độ', '°C'], humidity: ['Độ ẩm', '%'], pressure: ['Áp suất', 'hPa'] } as const;
  const trend = /xu huong|thay doi|tang|giam/.test(foldText(query));
  for (const metric of report.metrics) {
    if (metric === 'rain') {
      const r = report.rain;
      lines.push(`Trạm ghi nhận ${display(r.rainfallMm)} mm (${r.tips} nhịp ngoài thử nước) trong ${report.label}.`);
      lines.push(describeRainWindow(r, { testing: isWaterTestQuery(query), demo: context.dataQuality?.demo, timezone: context.timezone }));
      continue;
    }
    const s = report.weather[metric];
    const [label, unit] = labels[metric];
    if (!s) { lines.push(`${label}: chưa có số đo hợp lệ trong khoảng này.`); continue; }
    let text = `${label}: trung bình các bản đo ${display(s.avg)} ${unit}, thấp nhất ${display(s.min)} ${unit}, cao nhất ${display(s.max)} ${unit}`;
    if (s.lastValue !== undefined) text += `; bản đo cuối ${display(s.lastValue)} ${unit}`;
    text += '.';
    if (s.firstObservedAt && s.lastObservedAt) text += ` Có ${s.sampleCount} bản đo từ ${time(s.firstObservedAt)} đến ${time(s.lastObservedAt)}.`;
    if (trend && s.firstValue !== undefined && s.lastValue !== undefined) {
      const delta = s.lastValue - s.firstValue;
      text += (s.sampleCount ?? 0) >= 2 ? ` Chênh lệch đầu–cuối phần đã đo: ${delta > 0 ? '+' : ''}${display(delta)} ${unit}; không suy ra diễn biến ở khoảng thiếu.` : ' Một bản đo chưa đủ để xác định mức thay đổi.';
    }
    lines.push(text);
  }
  if (report.metrics.some((m) => m !== 'rain' && !report.weather[m]?.coverageComplete)) lines.push('Chuỗi số đo chưa phủ liên tục toàn khoảng yêu cầu; vẫn báo cáo phần đã có ở trên, chưa đại diện cho toàn khoảng.');
  if (report.historyTruncated) lines.push('Truy vấn chạm giới hạn bản ghi; báo cáo có thể thiếu lịch sử.');
  return lines.join('\n\n');
}

function compactReport(report: ObservationReport, context: StationContext, query: string): string {
  const time = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: context.timezone, hour12: false });
  const lines: string[] = [];
  const names = { temperature: ['Nhiệt độ', '°C'], humidity: ['Độ ẩm', '%'], pressure: ['Áp suất', 'hPa'] } as const;
  const trend = /xu huong|thay doi|tang|giam/.test(foldText(query));
  for (const metric of report.metrics) {
    if (metric === 'rain') {
      const r = report.rain;
      lines.push(`Trong ${report.label}, trạm ghi nhận ${display(r.rainfallMm)} mm (${r.tips} nhịp).`);
      continue;
    }
    const [label, unit] = names[metric], s = report.weather[metric];
    if (!s) { lines.push(`${label}: chưa có số đo hợp lệ trong khoảng này.`); continue; }
    let text = `${label}: trung bình ${display(s.avg)} ${unit}`;
    if (/thap nhat|cao nhat|min|max|bien do/.test(foldText(query))) text += `; thấp nhất ${display(s.min)}, cao nhất ${display(s.max)} ${unit}`;
    if (trend && s.firstValue !== undefined && s.lastValue !== undefined && (s.sampleCount ?? 0) >= 2) text += `; chênh đầu–cuối ${display(s.lastValue - s.firstValue)} ${unit}`;
    lines.push(`${text}.`);
    if (report.metrics.length === 1) lines.push(metric === 'temperature' ? temperatureInterpretation(s.avg) : metric === 'humidity' ? humidityInterpretation(s.avg) : pressureInterpretation(report.weather.pressureDelta3hHpa));
  }
  if (report.metrics.includes('rain')) lines.push(describeRainWindow(report.rain, { testing: isWaterTestQuery(query), demo: context.dataQuality?.demo, timezone: context.timezone }));
  const measured = [report.weather.temperature, report.weather.humidity, report.weather.pressure].filter((s) => s?.firstObservedAt && s?.lastObservedAt);
  if (measured.length && report.metrics.some((m) => m !== 'rain' && !report.weather[m]?.coverageComplete)) {
    const first = measured.map((s) => s!.firstObservedAt!).sort()[0], last = measured.map((s) => s!.lastObservedAt!).sort().at(-1)!;
    lines.push(`${report.weather.availableSampleCount ?? report.weather.sampleCount} bản đo có dữ liệu hợp lệ từ ${time(first)} đến ${time(last)}.`);
    if (report.metrics.some((m) => m !== 'rain' && !report.weather[m]?.coverageComplete)) lines.push('Chuỗi chưa phủ liên tục toàn khoảng; thống kê chỉ phản ánh phần đã đo.');
  }
  if (report.historyTruncated) lines.push('Truy vấn chạm giới hạn bản ghi, có thể thiếu lịch sử.');
  lines.push(`Trạm ${context.deviceId}: ${time(report.from)}–${time(report.to)} (${context.timezone}).`);
  return lines.join('\n');
}
