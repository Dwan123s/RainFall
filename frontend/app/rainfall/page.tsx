'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CloudRain,
  Droplets,
  TrendingUp,
  BarChart3,
  Waves,
  Zap
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { api } from '@/lib/api';
import { useTheme } from '@/app/providers';
import { formatDateTimeVi, formatTimeVi } from '@/lib/utils';
import { getRainRateCategoryVi } from '@/lib/weather-calc';

export default function RainfallPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [chartMode, setChartMode] = useState<'hourly' | 'daily'>('hourly');

  // Fetch rainfall statistics
  const { data: stats, isLoading } = useQuery({
    queryKey: ['rainfall', 'RS-ESP32S3-01'],
    queryFn: () => api.getRainfallStats('RS-ESP32S3-01'),
    refetchInterval: 10000
  });

  // Fetch hourly rain
  const { data: hourlyRain = [] } = useQuery({
    queryKey: ['hourlyRain', 'RS-ESP32S3-01'],
    queryFn: () => api.getHourlyRain('RS-ESP32S3-01', 24)
  });

  // Fetch daily rain (7 days)
  const { data: dailyRain = [] } = useQuery({
    queryKey: ['dailyRain', 'RS-ESP32S3-01'],
    queryFn: () => api.getDailyRain('RS-ESP32S3-01', 7)
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Đang tổng hợp số liệu lượng mưa...</p>
      </div>
    );
  }

  const rainCategory = getRainRateCategoryVi(stats?.currentRateMmH ?? 0);

  const tooltipStyle = isDark
    ? { backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: '#F1F5F9' }
    : { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: '12px', color: '#0F172A', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' };

  const gridStroke = isDark ? '#334155' : '#E2E8F0';
  const axisStroke = isDark ? '#64748B' : '#94A3B8';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <CloudRain className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
            <span>Phân Tích Chi Tiết Lượng Mưa (Rainfall Analytics)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Theo dõi lượng mưa tích lũy, cường độ mưa theo cửa sổ trượt, và xung đếm cảm biến Hall A3144
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
            <Waves className="w-3.5 h-3.5" />
            <span>{rainCategory.labelVi}</span>
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
            Hiệu chuẩn: {stats?.calibrationFactor ?? 0.64} mm/lần lật
          </span>
        </div>
      </div>

      {/* A. THỐNG KÊ LƯỢNG MƯA TÍCH LŨY */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm transition-colors">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            Hôm nay (00:00 - nay)
          </span>
          <div className="text-2xl font-bold font-mono text-cyan-600 dark:text-cyan-400">
            {stats?.todayMm?.toFixed(2) ?? '0.00'} <span className="text-xs font-normal text-slate-400">mm</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {stats?.totalTipsToday ?? 0} nhịp lật
          </span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm transition-colors">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            Hôm qua
          </span>
          <div className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-200">
            {stats?.yesterdayMm?.toFixed(2) ?? '0.00'} <span className="text-xs font-normal text-slate-400">mm</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Cả ngày hôm qua</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm transition-colors">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            24 giờ trượt
          </span>
          <div className="text-2xl font-bold font-mono text-cyan-600 dark:text-cyan-300">
            {stats?.rolling24hMm?.toFixed(2) ?? '0.00'} <span className="text-xs font-normal text-slate-400">mm</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Cửa sổ 24h gần nhất</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm transition-colors">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            7 ngày qua
          </span>
          <div className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-200">
            {stats?.last7DaysMm?.toFixed(2) ?? '0.00'} <span className="text-xs font-normal text-slate-400">mm</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Tổng 7 ngày gần đây</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm transition-colors">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            Tháng này
          </span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {stats?.currentMonthMm?.toFixed(2) ?? '0.00'} <span className="text-xs font-normal text-slate-400">mm</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Từ ngày 1 đầu tháng</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm transition-colors">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            Tổng vòng đời
          </span>
          <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
            {stats?.lifetimeMm?.toFixed(2) ?? '0.00'} <span className="text-xs font-normal text-slate-400">mm</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {stats?.lifetimeTips ?? 0} nhịp tổng
          </span>
        </div>
      </section>

      {/* B. CƯỜNG ĐỘ MƯA & TIPPING BUCKET */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cường độ tức thời (5 phút) */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Cường độ mưa tức thời (5 phút)</span>
            <Zap className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold font-mono text-cyan-600 dark:text-cyan-400">
              {stats?.currentRateMmH?.toFixed(1) ?? '0.0'}
            </span>
            <span className="text-sm font-bold text-slate-400">mm/h</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            Công thức: Lượng mưa trong cửa sổ 5 phút / (5 / 60 giờ)
          </p>
        </div>

        {/* Cường độ mưa đỉnh (Max observed) */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Cường độ đỉnh ghi nhận</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold font-mono text-amber-600 dark:text-amber-400">
              {stats?.maxObservedRateMmH?.toFixed(1) ?? '0.0'}
            </span>
            <span className="text-sm font-bold text-slate-400">mm/h</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            Thời điểm đỉnh: {stats?.timeOfMaxRate ? formatTimeVi(stats.timeOfMaxRate) : 'Chưa có mưa'}
          </p>
        </div>

        {/* Thông số gầu lật A3144 */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Cảm biến lật gầu Hall A3144</span>
            <Droplets className="w-4 h-4 text-blue-500" />
          </div>
          <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 pt-1">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Tổng số xung lật (Lifetime):</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{stats?.lifetimeTips ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Hệ số hiệu chuẩn trạm:</span>
              <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{stats?.calibrationFactor ?? 0.25} mm/tip</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Lần lật gần nhất:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {stats?.lastTipTimestamp ? formatDateTimeVi(stats.lastTipTimestamp) : 'Chưa ghi nhận'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* C. INTERACTIVE RAINFALL CHARTS */}
      <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <span>Biểu đồ phân bố lượng mưa</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Lượng mưa tích lũy được gom theo từng giờ (24h qua) hoặc từng ngày (7 ngày qua)
            </p>
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
            <button
              onClick={() => setChartMode('hourly')}
              className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
                chartMode === 'hourly'
                  ? 'bg-white dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Theo từng giờ (24h)
            </button>
            <button
              onClick={() => setChartMode('daily')}
              className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
                chartMode === 'daily'
                  ? 'bg-white dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Theo từng ngày (7 ngày)
            </button>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartMode === 'hourly' ? hourlyRain : dailyRain}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.6} />
              <XAxis
                dataKey={chartMode === 'hourly' ? 'hour' : 'dayLabel'}
                stroke={axisStroke}
                fontSize={11}
              />
              <YAxis stroke={axisStroke} fontSize={11} unit=" mm" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="rainfallMm" name="Lượng mưa (mm)" fill="#06B6D4" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
