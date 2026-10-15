'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Thermometer,
  Droplets,
  Gauge,
  Activity,
  Layers
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from 'recharts';
import { api } from '@/lib/api';
import { useTheme } from '@/app/providers';
import { formatTimeVi, formatDateTimeVi } from '@/lib/utils';
import {
  calculateDewPoint,
  calculateHeatIndex,
  classifyPressureTrend,
  getHumidityStatusVi
} from '@rainsense/shared';

export default function EnvironmentalPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [range, setRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');

  // Fetch summary statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['environmentalStats', 'RS-ESP32S3-01'],
    queryFn: () => api.getEnvironmentalStats('RS-ESP32S3-01'),
    refetchInterval: 10000
  });

  // Fetch measurement series for charts
  const { data: series = [], isLoading: seriesLoading } = useQuery({
    queryKey: ['telemetrySeries', range],
    queryFn: () => api.getMeasurements('RS-ESP32S3-01', range),
    refetchInterval: 15000
  });

  if (statsLoading || seriesLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Đang tổng hợp dữ liệu môi trường...</p>
      </div>
    );
  }

  const chartData = series.map((m: any) => ({
    time: formatTimeVi(m.timestamp),
    fullTime: formatDateTimeVi(m.timestamp),
    temperature: m.temperature,
    humidity: m.humidity,
    pressure: m.pressure,
    dewPoint: m.dewPoint ?? calculateDewPoint(m.temperature, m.humidity),
    heatIndex: calculateHeatIndex(m.temperature, m.humidity)
  }));

  const hasData = stats?.temperature?.current !== null && stats?.temperature?.current !== undefined;
  const currentTemp = hasData ? stats.temperature.current : null;
  const currentHumid = stats?.humidity?.current ?? null;
  const currentPress = stats?.pressure?.current ?? null;
  const dewPoint = hasData && currentHumid !== null ? calculateDewPoint(currentTemp, currentHumid) : null;
  const heatIndex = hasData && currentHumid !== null ? calculateHeatIndex(currentTemp, currentHumid) : null;
  const humidityStatus = currentHumid !== null ? getHumidityStatusVi(currentHumid) : { label: 'Chờ dữ liệu', color: 'text-slate-400' };
  const pressureTrend = currentPress !== null ? classifyPressureTrend(currentPress) : { category: 'STABLE', labelVi: 'Chờ dữ liệu', rateHPaPer3h: 0 };

  const tooltipStyle = isDark
    ? { backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: '#F1F5F9' }
    : { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: '12px', color: '#0F172A', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' };

  const gridStroke = isDark ? '#334155' : '#E2E8F0';
  const axisStroke = isDark ? '#64748B' : '#94A3B8';

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Thermometer className="w-7 h-7 text-orange-500" />
            <span>Phân Tích Thông Số Môi Trường (Environmental Analytics)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Nhiệt độ, độ ẩm tương đối, áp suất khí quyển, điểm sương (Dew Point) và chỉ số nhiệt (Heat Index) từ cảm biến BME280
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
          {(['1h', '6h', '24h', '7d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg transition-all font-mono font-medium ${
                range === r
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* 3 Metric Cards with Min/Max/Avg */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* NHIỆT ĐỘ */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nhiệt độ (°C)</span>
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
              <Thermometer className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold font-mono text-slate-900 dark:text-slate-100">
              {currentTemp !== null ? currentTemp.toFixed(1) : '--'}
            </span>
            <span className="text-lg font-bold text-orange-500">°C</span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <div className="p-2 rounded bg-slate-100 dark:bg-slate-800/40 text-center">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Thấp nhất</span>
              <span className="font-mono font-semibold text-blue-500 dark:text-blue-400">{stats?.temperature?.min !== null && stats?.temperature?.min !== undefined ? `${stats.temperature.min.toFixed(1)}°C` : '--'}</span>
            </div>
            <div className="p-2 rounded bg-slate-100 dark:bg-slate-800/40 text-center">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Trung bình</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{stats?.temperature?.avg !== null && stats?.temperature?.avg !== undefined ? `${stats.temperature.avg.toFixed(1)}°C` : '--'}</span>
            </div>
            <div className="p-2 rounded bg-slate-100 dark:bg-slate-800/40 text-center">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Cao nhất</span>
              <span className="font-mono font-semibold text-rose-500 dark:text-rose-400">{stats?.temperature?.max !== null && stats?.temperature?.max !== undefined ? `${stats.temperature.max.toFixed(1)}°C` : '--'}</span>
            </div>
          </div>
        </div>

        {/* ĐỘ ẨM */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Độ ẩm tương đối (%)</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <Droplets className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold font-mono text-slate-900 dark:text-slate-100">
              {currentHumid !== null ? currentHumid.toFixed(1) : '--'}
            </span>
            <span className="text-lg font-bold text-blue-500">%</span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <div className="p-2 rounded bg-slate-100 dark:bg-slate-800/40 text-center">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Thấp nhất</span>
              <span className="font-mono font-semibold text-amber-500 dark:text-amber-400">{stats?.humidity?.min !== null && stats?.humidity?.min !== undefined ? `${stats.humidity.min.toFixed(1)}%` : '--'}</span>
            </div>
            <div className="p-2 rounded bg-slate-100 dark:bg-slate-800/40 text-center">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Trung bình</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{stats?.humidity?.avg !== null && stats?.humidity?.avg !== undefined ? `${stats.humidity.avg.toFixed(1)}%` : '--'}</span>
            </div>
            <div className="p-2 rounded bg-slate-100 dark:bg-slate-800/40 text-center">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Cao nhất</span>
              <span className="font-mono font-semibold text-blue-500 dark:text-blue-400">{stats?.humidity?.max !== null && stats?.humidity?.max !== undefined ? `${stats.humidity.max.toFixed(1)}%` : '--'}</span>
            </div>
          </div>
        </div>

        {/* ÁP SUẤT */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Áp suất khí quyển (hPa)</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold font-mono text-slate-900 dark:text-slate-100">
              {currentPress !== null ? currentPress.toFixed(1) : '--'}
            </span>
            <span className="text-lg font-bold text-purple-500">hPa</span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <div className="p-2 rounded bg-slate-100 dark:bg-slate-800/40 text-center">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Thấp nhất</span>
              <span className="font-mono font-semibold text-purple-500 dark:text-purple-300">{stats?.pressure?.min !== null && stats?.pressure?.min !== undefined ? stats.pressure.min.toFixed(1) : '--'}</span>
            </div>
            <div className="p-2 rounded bg-slate-100 dark:bg-slate-800/40 text-center">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Trung bình</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{stats?.pressure?.avg !== null && stats?.pressure?.avg !== undefined ? stats.pressure.avg.toFixed(1) : '--'}</span>
            </div>
            <div className="p-2 rounded bg-slate-100 dark:bg-slate-800/40 text-center">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Cao nhất</span>
              <span className="font-mono font-semibold text-purple-500 dark:text-purple-300">{stats?.pressure?.max !== null && stats?.pressure?.max !== undefined ? stats.pressure.max.toFixed(1) : '--'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Derived Measurements Card */}
      <section className="bg-card border border-border rounded-2xl p-5 shadow-sm transition-colors">
        <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2 text-sm">
          <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span>Các thông số dẫn xuất theo tiêu chuẩn Khí tượng học</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50">
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-600 dark:text-slate-400">Điểm sương (Dew Point):</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                {dewPoint !== null ? `${dewPoint.toFixed(1)} °C` : '--'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Công thức Magnus-Tetens (a=17.27, b=237.7). Nhiệt độ mà tại đó hơi nước bắt đầu ngưng tụ thành sương.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50">
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-600 dark:text-slate-400">Chỉ số nhiệt cảm nhận (Heat Index):</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                {heatIndex !== null ? `${heatIndex.toFixed(1)} °C` : '--'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Mô hình phương trình hồi quy đa biến Rothfusz (kết hợp tác động giữa nhiệt độ khô và độ ẩm không khí).
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50">
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-600 dark:text-slate-400">Xu hướng khí áp 3 giờ:</span>
              <span className="font-mono font-bold text-purple-600 dark:text-purple-400 text-sm">{pressureTrend.labelVi}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Đánh giá biến thiên áp suất Delta P. Giảm &gt; 3 hPa/3h là dấu hiệu giông bão cận kề.
            </p>
          </div>
        </div>
      </section>

      {/* Main Environmental Charts */}
      <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
        <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 text-sm">
          <Activity className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span>Biểu đồ diễn biến Nhiệt độ, Điểm sương và Độ ẩm</span>
        </h3>
        <div className="h-80 w-full">
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full border border-dashed border-border rounded-xl p-8 text-center space-y-2 bg-slate-50/50 dark:bg-slate-900/20">
              <Activity className="w-9 h-9 text-orange-500/40 animate-pulse" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Chưa có dữ liệu cảm biến môi trường từ ESP32-S3
              </p>
              <p className="text-xs text-slate-500 max-w-sm">
                Biểu đồ sẽ vẽ tức thì ngay khi cảm biến BME280 gửi bản tin telemetry đầu tiên.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.6} />
                <XAxis dataKey="time" stroke={axisStroke} fontSize={11} minTickGap={30} />
                <YAxis yAxisId="left" stroke="#F97316" fontSize={11} unit="°C" domain={['auto', 'auto']} />
                <YAxis yAxisId="right" orientation="right" stroke="#3B82F6" fontSize={11} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="temperature" name="Nhiệt độ (°C)" stroke="#F97316" strokeWidth={2} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="dewPoint" name="Điểm sương (°C)" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="humidity" name="Độ ẩm (%)" stroke="#3B82F6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Barometric Pressure Chart */}
      <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
        <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 text-sm">
          <Gauge className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span>Diễn biến Áp suất khí quyển (Barometric Pressure)</span>
        </h3>
        <div className="h-72 w-full">
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full border border-dashed border-border rounded-xl p-8 text-center space-y-2 bg-slate-50/50 dark:bg-slate-900/20">
              <Gauge className="w-9 h-9 text-purple-500/40 animate-pulse" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Chưa có dữ liệu áp suất khí quyển từ ESP32-S3
              </p>
              <p className="text-xs text-slate-500 max-w-sm">
                Biểu đồ áp suất khí quyển sẽ hiển thị theo chuỗi thời gian khi nhận được dữ liệu BME280.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="pressGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A855F7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#A855F7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.6} />
                <XAxis dataKey="time" stroke={axisStroke} fontSize={11} minTickGap={30} />
                <YAxis stroke={axisStroke} fontSize={11} domain={['dataMin - 2', 'dataMax + 2']} unit=" hPa" />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="pressure" name="Áp suất (hPa)" stroke="#A855F7" strokeWidth={2} fill="url(#pressGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  );
}
