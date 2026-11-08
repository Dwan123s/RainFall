import type { WeatherFeatures } from './ai-types';
import type { RainWindow, StationContext } from './rainsense-ai';
import { foldText } from './project-knowledge';
import { wantsDetailedAnswer } from './answer-style';
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
      lines.push(`Lượng nước qua gầu quy đổi, đã loại dữ liệu thử được đánh dấu: ${display(r.rainfallMm)} mm, ${r.tips} nhịp theo mốc ghi nhận trong khoảng được hỏi.${r.coverageComplete ? '' : ' Bản tin chưa phủ đủ khoảng, nên đây chỉ là phần đã ghi nhận; không xác nhận toàn khoảng không mưa nếu chưa có nhịp.'}`);
      lines.push(`Nước thử tách riêng: ${display(r.testRainfallMm ?? 0)} mm, ${r.testTips ?? 0} nhịp; không đưa vào tổng trên và không dùng làm bằng chứng thời tiết.`);
      if (r.uncertainTimingEvents) lines.push('Có sự kiện gộp theo bản tin hoặc dữ liệu cũ: mốc lưu không chứng minh giờ chính xác của từng nhịp; tổng sát ranh giới giờ/ngày có thể chưa xác định chính xác.');
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
  if (report.metrics.includes('rain')) lines.push(/thu nuoc|xa nuoc|do nuoc|\btest\b|thu nghiem/.test(foldText(query)) ? 'Theo bạn mô tả đây là thử nước; các số mm không phải xác nhận mưa tự nhiên.' : 'Gầu không phân biệt nước thử và mưa tự nhiên; các số trên mô tả dữ liệu đã ghi nhận.');
  return lines.join('\n\n');
}

function compactReport(report: ObservationReport, context: StationContext, query: string): string {
  const time = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: context.timezone, hour12: false });
  const lines = [`Trạm ${context.stationName} (${context.deviceId}), ${report.label}: ${time(report.from)}–${time(report.to)} (${context.timezone}).`];
  const names = { temperature: ['Nhiệt độ', '°C'], humidity: ['Độ ẩm', '%'], pressure: ['Áp suất', 'hPa'] } as const;
  const trend = /xu huong|thay doi|tang|giam/.test(foldText(query));
  for (const metric of report.metrics) {
    if (metric === 'rain') {
      const r = report.rain;
      lines.push(`Nước qua gầu: ${display(r.rainfallMm)} mm (${r.tips} nhịp), đã loại thử được đánh dấu. Nước thử tách riêng: ${display(r.testRainfallMm ?? 0)} mm (${r.testTips ?? 0} nhịp).`);
      if (!r.coverageComplete) lines.push('Bản tin chưa phủ đủ; đây là phần đã lưu, không xác nhận toàn khoảng không mưa.');
      if (r.uncertainTimingEvents) lines.push('Có lô nhịp hoặc dữ liệu cũ chưa biết giờ từng nhịp; tổng sát ranh giới thời gian còn bất định.');
      continue;
    }
    const [label, unit] = names[metric], s = report.weather[metric];
    if (!s) { lines.push(`${label}: chưa có số đo hợp lệ trong khoảng này.`); continue; }
    let text = `${label}: trung bình ${display(s.avg)} ${unit}; thấp nhất ${display(s.min)}, cao nhất ${display(s.max)} ${unit}`;
    if (trend && s.firstValue !== undefined && s.lastValue !== undefined && (s.sampleCount ?? 0) >= 2) text += `; chênh đầu–cuối ${display(s.lastValue - s.firstValue)} ${unit}`;
    lines.push(`${text}.`);
  }
  const measured = [report.weather.temperature, report.weather.humidity, report.weather.pressure].filter((s) => s?.firstObservedAt && s?.lastObservedAt);
  if (measured.length && report.metrics.some((m) => m !== 'rain')) {
    const first = measured.map((s) => s!.firstObservedAt!).sort()[0], last = measured.map((s) => s!.lastObservedAt!).sort().at(-1)!;
    lines.push(`${report.weather.availableSampleCount ?? report.weather.sampleCount} bản đo có dữ liệu hợp lệ từ ${time(first)} đến ${time(last)}.`);
    if (report.metrics.some((m) => m !== 'rain' && !report.weather[m]?.coverageComplete)) lines.push('Chuỗi chưa phủ liên tục toàn khoảng; thống kê chỉ phản ánh phần đã đo.');
  }
  if (report.historyTruncated) lines.push('Truy vấn chạm giới hạn bản ghi, có thể thiếu lịch sử.');
  if (report.metrics.includes('rain')) lines.push('Gầu chưa xác minh mưa tự nhiên; nước thử không dùng làm bằng chứng thời tiết.');
  return lines.join('\n');
}
