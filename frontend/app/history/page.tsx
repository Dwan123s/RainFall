'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  Download,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  Table as TableIcon
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { api } from '@/lib/api';
import { useTheme } from '@/app/providers';
import { formatDateTimeVi, formatTimeVi } from '@/lib/utils';

export default function HistoryPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [stationId] = useState('RS-ESP32S3-01');
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [measurementFilter, setMeasurementFilter] = useState<'all' | 'temperature' | 'humidity' | 'pressure' | 'rain'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Fetch telemetry measurements
  const { data: measurements = [], isLoading } = useQuery({
    queryKey: ['historyMeasurements', stationId, range],
    queryFn: () => api.getMeasurements(stationId, range),
    refetchInterval: 30000
  });

  // Calculate pagination
  const total = measurements.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginated = measurements.slice((page - 1) * pageSize, page * pageSize);

  const handleExportCsv = () => {
    const url = api.getExportUrl(stationId);
    window.open(url, '_blank');
  };

  const chartData = measurements.map((m: any) => ({
    time: formatTimeVi(m.timestamp),
    fullTime: formatDateTimeVi(m.timestamp),
    temperature: m.temperature,
    humidity: m.humidity,
    pressure: m.pressure,
    rainRate: m.rainRate ?? 0
  }));

  const tooltipStyle = isDark
    ? { backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: '#F1F5F9' }
    : { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: '12px', color: '#0F172A', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' };

  const gridStroke = isDark ? '#334155' : '#E2E8F0';
  const axisStroke = isDark ? '#64748B' : '#94A3B8';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <History className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
            <span>Khai Thác Dữ Liệu Lịch Sử (Historical Data Explorer)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Truy vấn dữ liệu cảm biến quan trắc theo khoảng thời gian, phân trang máy chủ và xuất báo cáo CSV
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-colors self-start sm:self-auto shadow-sm"
        >
          <Download className="w-4 h-4" />
          <span>Xuất Báo Cáo CSV</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <section className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4 text-xs transition-colors">
        <div className="flex flex-wrap items-center gap-3">
          {/* Station selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Trạm:</span>
            <span className="font-mono font-bold text-cyan-700 dark:text-cyan-400 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {stationId}
            </span>
          </div>

          {/* Time range */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
            {(['24h', '7d', '30d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRange(r);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-lg font-mono font-medium ${
                  range === r
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {r === '24h' ? '24 giờ qua' : r === '7d' ? '7 ngày qua' : '30 ngày qua'}
              </button>
            ))}
          </div>

          {/* Measurement filter */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <button
              onClick={() => setMeasurementFilter('all')}
              className={`px-3 py-1 rounded-lg ${measurementFilter === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setMeasurementFilter('temperature')}
              className={`px-3 py-1 rounded-lg ${measurementFilter === 'temperature' ? 'bg-white dark:bg-orange-500/20 text-orange-600 dark:text-orange-300 font-bold shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Nhiệt độ
            </button>
            <button
              onClick={() => setMeasurementFilter('humidity')}
              className={`px-3 py-1 rounded-lg ${measurementFilter === 'humidity' ? 'bg-white dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 font-bold shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Độ ẩm
            </button>
            <button
              onClick={() => setMeasurementFilter('pressure')}
              className={`px-3 py-1 rounded-lg ${measurementFilter === 'pressure' ? 'bg-white dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 font-bold shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Áp suất
            </button>
          </div>
        </div>

        <div className="text-slate-500 dark:text-slate-400 font-mono">
          Tổng cộng: <strong className="text-slate-900 dark:text-slate-200">{total}</strong> bản ghi
        </div>
      </section>

      {/* Historical Trend Chart */}
      <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span>Biểu đồ biến thiên lịch sử</span>
        </h2>
        <div className="h-64 w-full">
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full border border-dashed border-border rounded-xl p-8 text-center space-y-2 bg-slate-50/50 dark:bg-slate-900/20">
              <History className="w-9 h-9 text-cyan-500/40 animate-pulse" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Chưa có dữ liệu lịch sử từ trạm {stationId}
              </p>
              <p className="text-xs text-slate-500 max-w-sm">
                Bản ghi đo từ ESP32-S3 sẽ được lưu trữ tự động vào cơ sở dữ liệu và hiển thị tại đây.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.6} />
                <XAxis dataKey="time" stroke={axisStroke} fontSize={11} minTickGap={40} />
                <YAxis stroke={axisStroke} fontSize={11} domain={['auto', 'auto']} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey={
                    measurementFilter === 'temperature'
                      ? 'temperature'
                      : measurementFilter === 'humidity'
                      ? 'humidity'
                      : measurementFilter === 'pressure'
                      ? 'pressure'
                      : 'temperature'
                  }
                  name={
                    measurementFilter === 'temperature'
                      ? 'Nhiệt độ (°C)'
                      : measurementFilter === 'humidity'
                      ? 'Độ ẩm (%)'
                      : measurementFilter === 'pressure'
                      ? 'Áp suất (hPa)'
                      : 'Nhiệt độ (°C)'
                  }
                  stroke="#06B6D4"
                  strokeWidth={2}
                  fill="url(#histGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Historical Data Table */}
      <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <TableIcon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>Bảng dữ liệu chi tiết</span>
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Trang {page} / {totalPages}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-slate-600 dark:text-slate-400 font-semibold bg-slate-50 dark:bg-slate-800/30">
                <th className="py-2.5 px-4">Thời gian</th>
                <th className="py-2.5 px-4">Mã bản tin (Message ID)</th>
                <th className="py-2.5 px-4 font-mono text-orange-500">Nhiệt độ (°C)</th>
                <th className="py-2.5 px-4 font-mono text-emerald-600 dark:text-emerald-400">Điểm sương (°C)</th>
                <th className="py-2.5 px-4 font-mono text-blue-500">Độ ẩm (%)</th>
                <th className="py-2.5 px-4 font-mono text-purple-500">Áp suất (hPa)</th>
                <th className="py-2.5 px-4 font-mono text-cyan-600 dark:text-cyan-400">Mưa tức thời</th>
                <th className="py-2.5 px-4 font-mono text-slate-500 dark:text-slate-400">Tín hiệu RSSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-mono">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500 italic">
                    Chưa có bản ghi quan trắc nào được lưu trữ từ trạm {stationId} trong khoảng thời gian này.
                  </td>
                </tr>
              ) : (
                paginated.map((row: any) => (
                  <tr key={row.messageId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                      {formatDateTimeVi(row.timestamp)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 dark:text-slate-500 text-[11px]">
                      {row.messageId}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-200">
                      {row.temperature.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-4 text-emerald-600 dark:text-emerald-400">
                      {row.dewPoint ? row.dewPoint.toFixed(1) : '--'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-900 dark:text-slate-200">
                      {row.humidity.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-900 dark:text-slate-200">
                      {row.pressure.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-4 text-cyan-600 dark:text-cyan-400 font-bold">
                      {row.rainRate !== undefined ? `${row.rainRate.toFixed(1)} mm/h` : '0.0 mm/h'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">
                      {row.wifiRssi} dBm
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between pt-3 border-t border-border text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            Hiển thị {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} trong số {total} bản ghi
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-slate-800 dark:text-slate-200 px-2 font-bold">{page}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
