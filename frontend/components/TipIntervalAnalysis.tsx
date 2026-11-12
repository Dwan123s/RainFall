'use client';

import React, { useMemo } from 'react';
import {
  Timer,
  CloudRain,
  Zap,
  Activity,
  ArrowRight,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';
import { formatTimeVi } from '@/lib/utils';
import { DemoScenarioId } from '@/lib/demo-scenarios';

interface TipIntervalAnalysisProps {
  rainfall: any;
  deviceId?: string;
  isDemoMode?: boolean;
  demoScenario?: DemoScenarioId;
}

interface TipHistoryItem {
  id: string;
  time: string;
  intervalSec: number;
  rateMmH: number;
  label: string;
  badgeClass: string;
}

export function TipIntervalAnalysis({
  rainfall,
  isDemoMode = false,
  demoScenario = 'low'
}: TipIntervalAnalysisProps) {
  const calFactor = rainfall?.calibrationFactor ?? 0.64;

  // Tính toán khoảng thời gian lật và cường độ theo chế độ
  const analysis = useMemo(() => {
    if (isDemoMode) {
      // Dữ liệu mô phỏng trực quan theo 4 kịch bản Demo
      switch (demoScenario) {
        case 'critical': {
          // Demo 4: Mưa cực lớn, nhịp lật dồn dập 12 - 16 giây/lần
          const intervalSec = 14;
          const rate = Math.round((calFactor * 3600 / intervalSec) * 10) / 10;
          return {
            intervalSec,
            intervalFormatted: '14 giây / lần',
            rateMmH: rate,
            peakIntervalSec: 10,
            peakIntervalFormatted: '10 giây',
            peakRateMmH: Math.round((calFactor * 3600 / 10) * 10) / 10,
            densityLabel: 'Cực kỳ dồn dập (Mưa như trút nước)',
            densityColor: 'text-rose-500',
            densityBg: 'bg-rose-500/15',
            densityBorder: 'border-rose-500/40',
            gaugePercent: 95,
            lastTipText: 'Vừa lật cách đây 8 giây',
            isActive: true,
            summaryVi: 'Gàu lật liên hồi 14 giây/nhịp. Nước đổ dồn dập vượt khả năng tiêu thoát của cống rãnh!',
            history: [
              { id: '1', time: 'Vừa xong', intervalSec: 14, rateMmH: 164.6, label: 'Xối xả', badgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
              { id: '2', time: '-14s', intervalSec: 12, rateMmH: 192.0, label: 'Xối xả', badgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
              { id: '3', time: '-26s', intervalSec: 10, rateMmH: 230.4, label: 'Đỉnh cực đại', badgeClass: 'bg-rose-500/30 text-rose-300 border-rose-500/50 font-bold' },
              { id: '4', time: '-36s', intervalSec: 15, rateMmH: 153.6, label: 'Xối xả', badgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
              { id: '5', time: '-51s', intervalSec: 16, rateMmH: 144.0, label: 'Rất to', badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/30' }
            ]
          };
        }
        case 'high': {
          // Demo 3: Mưa to, dồn dập 40 - 55 giây/lần
          const intervalSec = 48;
          const rate = Math.round((calFactor * 3600 / intervalSec) * 10) / 10;
          return {
            intervalSec,
            intervalFormatted: '48 giây / lần',
            rateMmH: rate,
            peakIntervalSec: 32,
            peakIntervalFormatted: '32 giây',
            peakRateMmH: Math.round((calFactor * 3600 / 32) * 10) / 10,
            densityLabel: 'Mưa to dồn dập (Tạo dòng chảy tràn)',
            densityColor: 'text-orange-500',
            densityBg: 'bg-orange-500/15',
            densityBorder: 'border-orange-500/40',
            gaugePercent: 75,
            lastTipText: 'Vừa lật cách đây 35 giây',
            isActive: true,
            summaryVi: 'Mỗi 48 giây gàu lật 1 lần. Cường độ mưa dồn dập, nước bắt đầu tích tụ ở các vũng trũng thấp.',
            history: [
              { id: '1', time: 'Vừa xong', intervalSec: 48, rateMmH: 48.0, label: 'Mưa to', badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
              { id: '2', time: '-48s', intervalSec: 45, rateMmH: 51.2, label: 'Mưa to', badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
              { id: '3', time: '-1m33s', intervalSec: 32, rateMmH: 72.0, label: 'Đợt dồn', badgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
              { id: '4', time: '-2m05s', intervalSec: 52, rateMmH: 44.3, label: 'Mưa to', badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
              { id: '5', time: '-2m57s', intervalSec: 58, rateMmH: 39.7, label: 'Mưa to', badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/30' }
            ]
          };
        }
        case 'moderate': {
          // Demo 2: Mưa vừa, 2.5 - 4 phút/lần
          const intervalSec = 192; // 3m 12s
          const rate = Math.round((calFactor * 3600 / intervalSec) * 10) / 10;
          return {
            intervalSec,
            intervalFormatted: '3 phút 12 giây / lần',
            rateMmH: rate,
            peakIntervalSec: 140,
            peakIntervalFormatted: '2 phút 20 giây',
            peakRateMmH: Math.round((calFactor * 3600 / 140) * 10) / 10,
            densityLabel: 'Mưa vừa ổn định (Thoát nước tốt)',
            densityColor: 'text-amber-500',
            densityBg: 'bg-amber-500/15',
            densityBorder: 'border-amber-500/40',
            gaugePercent: 45,
            lastTipText: 'Vừa lật cách đây 1.5 phút',
            isActive: true,
            summaryVi: 'Khoảng cách giữa các nhịp lật ~3 phút. Lượng nước đến từ từ, hệ thống rãnh gom tiêu thoát êm.',
            history: [
              { id: '1', time: 'Vừa xong', intervalSec: 192, rateMmH: 12.0, label: 'Mưa vừa', badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
              { id: '2', time: '-3m', intervalSec: 180, rateMmH: 12.8, label: 'Mưa vừa', badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
              { id: '3', time: '-6m', intervalSec: 140, rateMmH: 16.5, label: 'Hạt dày', badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
              { id: '4', time: '-8m', intervalSec: 210, rateMmH: 11.0, label: 'Mưa vừa', badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
              { id: '5', time: '-11m', intervalSec: 240, rateMmH: 9.6, label: 'Mưa nhỏ', badgeClass: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
            ]
          };
        }
        default: {
          // Demo 1: Thấp, tạnh ráo, không có nhịp lật
          return {
            intervalSec: null,
            intervalFormatted: 'Không có nhịp lật (> 2 giờ)',
            rateMmH: 0,
            peakIntervalSec: null,
            peakIntervalFormatted: 'Không ghi nhận',
            peakRateMmH: 0,
            densityLabel: 'Tạnh ráo (Không có mưa)',
            densityColor: 'text-emerald-500',
            densityBg: 'bg-emerald-500/15',
            densityBorder: 'border-emerald-500/40',
            gaugePercent: 5,
            lastTipText: 'Không ghi nhận nhịp lật trong 2 giờ qua',
            isActive: false,
            summaryVi: 'Gàu lật đứng yên hoàn toàn. Không khí khô ráo, nguy cơ ngập úng bằng 0.',
            history: []
          };
        }
      }
    }

    // LIVE MODE: Tính toán trực tiếp từ dữ liệu cảm biến thực tế
    const currentRate = rainfall?.currentRateMmH ?? 0;
    const maxRate = rainfall?.maxObservedRateMmH ?? 0;
    const lastTipTimestamp = rainfall?.lastTipTimestamp;

    // Khoảng thời gian từ lần lật cuối đến hiện tại (giây)
    let secondsSinceLastTip: number | null = null;
    let lastTipAgoText = 'Chưa ghi nhận nhịp nào';
    if (lastTipTimestamp) {
      const diffMs = Date.now() - new Date(lastTipTimestamp).getTime();
      if (diffMs >= 0) {
        secondsSinceLastTip = Math.floor(diffMs / 1000);
        if (secondsSinceLastTip < 60) {
          lastTipAgoText = `${secondsSinceLastTip} giây trước (${formatTimeVi(lastTipTimestamp)})`;
        } else if (secondsSinceLastTip < 3600) {
          lastTipAgoText = `${Math.floor(secondsSinceLastTip / 60)} phút trước (${formatTimeVi(lastTipTimestamp)})`;
        } else {
          lastTipAgoText = `${(secondsSinceLastTip / 3600).toFixed(1)} giờ trước (${formatTimeVi(lastTipTimestamp)})`;
        }
      }
    }

    // Nếu đang có mưa (currentRate > 0)
    if (currentRate > 0) {
      const intervalSec = Math.max(1, Math.round((calFactor * 3600) / currentRate));
      let intervalFormatted = `${intervalSec} giây / lần`;
      if (intervalSec >= 60) {
        const m = Math.floor(intervalSec / 60);
        const s = intervalSec % 60;
        intervalFormatted = s > 0 ? `${m} phút ${s}s / lần` : `${m} phút / lần`;
      }

      let peakIntervalFormatted = '--';
      let peakSec: number | null = null;
      if (maxRate > 0) {
        peakSec = Math.max(1, Math.round((calFactor * 3600) / maxRate));
        peakIntervalFormatted = peakSec < 60 ? `${peakSec} giây` : `${Math.floor(peakSec / 60)}m ${peakSec % 60}s`;
      }

      let densityLabel = 'Mưa vừa ổn định';
      let densityColor = 'text-amber-500';
      let densityBg = 'bg-amber-500/15';
      let densityBorder = 'border-amber-500/40';
      let gaugePercent = 50;

      if (intervalSec <= 20) {
        densityLabel = 'Cực kỳ dồn dập (Xối xả)';
        densityColor = 'text-rose-500';
        densityBg = 'bg-rose-500/15';
        densityBorder = 'border-rose-500/40';
        gaugePercent = 95;
      } else if (intervalSec <= 60) {
        densityLabel = 'Mưa to dồn dập';
        densityColor = 'text-orange-500';
        densityBg = 'bg-orange-500/15';
        densityBorder = 'border-orange-500/40';
        gaugePercent = 75;
      } else if (intervalSec <= 300) {
        densityLabel = 'Mưa vừa ổn định';
        densityColor = 'text-amber-500';
        densityBg = 'bg-amber-500/15';
        densityBorder = 'border-amber-500/40';
        gaugePercent = 45;
      } else {
        densityLabel = 'Mưa nhỏ ngắt quãng';
        densityColor = 'text-blue-500';
        densityBg = 'bg-blue-500/15';
        densityBorder = 'border-blue-500/40';
        gaugePercent = 20;
      }

      return {
        intervalSec,
        intervalFormatted,
        rateMmH: currentRate,
        peakIntervalSec: peakSec,
        peakIntervalFormatted,
        peakRateMmH: maxRate,
        densityLabel,
        densityColor,
        densityBg,
        densityBorder,
        gaugePercent,
        lastTipText: lastTipAgoText,
        isActive: true,
        summaryVi: `Gàu lật trung bình ${intervalFormatted}. Cường độ đạt ${currentRate.toFixed(1)} mm/h.`,
        history: []
      };
    }

    // Không có mưa tức thời (currentRate == 0)
    let peakIntervalFormatted = '--';
    let peakSec: number | null = null;
    if (maxRate > 0) {
      peakSec = Math.max(1, Math.round((calFactor * 3600) / maxRate));
      peakIntervalFormatted = peakSec < 60 ? `${peakSec} giây` : `${Math.floor(peakSec / 60)}m ${peakSec % 60}s`;
    }

    return {
      intervalSec: null,
      intervalFormatted: 'Chưa có nhịp mới gần đây',
      rateMmH: 0,
      peakIntervalSec: peakSec,
      peakIntervalFormatted,
      peakRateMmH: maxRate,
      densityLabel: 'Tạnh ráo (Gàu đang đứng yên)',
      densityColor: 'text-slate-400 dark:text-slate-500',
      densityBg: 'bg-slate-100 dark:bg-slate-800/40',
      densityBorder: 'border-slate-200 dark:border-slate-700/60',
      gaugePercent: 0,
      lastTipText: lastTipAgoText,
      isActive: false,
      summaryVi: 'Hiện không ghi nhận xung lật gàu A3144. Cường độ mưa tức thời là 0.0 mm/h.',
      history: []
    };
  }, [rainfall, isDemoMode, demoScenario, calFactor]);

  return (
    <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <Timer className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
              <span>Tần Suất & Khoảng Cách Nhịp Lật Gàu</span>
              {isDemoMode && (
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  Demo
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Đo khoảng thời gian giữa các lần lật (Δt) để phân biệt mưa dồn dập vs mưa rải rác
            </p>
          </div>
        </div>

        <span
          className={`px-2.5 py-1 rounded-full text-xs font-semibold border inline-flex items-center gap-1.5 self-start sm:self-auto ${analysis.densityBg} ${analysis.densityBorder} ${analysis.densityColor}`}
        >
          {analysis.isActive && <span className="w-2 h-2 rounded-full bg-current animate-ping" />}
          <span>{analysis.densityLabel}</span>
        </span>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        {/* Card 1: Khoảng cách giữa 2 lần lật */}
        <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>Khoảng cách lật (Δt):</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className={`text-base font-extrabold font-mono ${analysis.densityColor}`}>
            {analysis.intervalFormatted}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {analysis.intervalSec ? `Cứ ${analysis.intervalSec}s gàu đổ 1 lần` : 'Gàu đang chờ tích nước'}
          </div>
        </div>

        {/* Card 2: Cường độ quy đổi từ nhịp */}
        <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>Cường độ tức thời:</span>
            <CloudRain className="w-3.5 h-3.5 text-cyan-500" />
          </div>
          <div className="text-base font-extrabold font-mono text-cyan-600 dark:text-cyan-400">
            {analysis.rateMmH.toFixed(1)} <span className="text-xs font-normal">mm/h</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Hệ số trạm: {calFactor} mm/lần
          </div>
        </div>

        {/* Card 3: Nhịp dồn dập nhất (Đỉnh) */}
        <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>Nhịp dồn nhất đợt mưa:</span>
            <Zap className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-base font-extrabold font-mono text-amber-600 dark:text-amber-400">
            {analysis.peakIntervalFormatted}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Đỉnh: {analysis.peakRateMmH.toFixed(1)} mm/h
          </div>
        </div>
      </div>

      {/* Visual Density Gauge */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-500" />
            <span>Mức độ dồn dập của dòng nước qua phễu</span>
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            Lần lật cuối: {analysis.lastTipText}
          </span>
        </div>

        {/* Multi-tier colored bar */}
        <div className="space-y-1">
          <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden p-0.5 relative">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                analysis.gaugePercent >= 80
                  ? 'bg-gradient-to-r from-orange-500 to-rose-500'
                  : analysis.gaugePercent >= 50
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                  : analysis.gaugePercent >= 20
                  ? 'bg-gradient-to-r from-blue-500 to-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.max(analysis.gaugePercent, 4)}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-0.5">
            <span>Tạnh (&gt;15m)</span>
            <span>Rải rác (5-15m)</span>
            <span>Mưa vừa (1-5m)</span>
            <span>Mưa to (30s-1m)</span>
            <span className="text-rose-500 font-bold">Xối xả (&lt;20s)</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-600 dark:text-slate-300 pt-1 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 text-cyan-500 shrink-0 mt-0.5" />
          <span>{analysis.summaryVi}</span>
        </p>
      </div>

      {/* Demo Tip History Sequence (hiển thị khi ở chế độ Demo để người dùng kiểm chứng nhịp gàu) */}
      {isDemoMode && analysis.history.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Chuỗi nhịp lật liên tiếp gần nhất (Khoảng cách giữa từng lần lật)</span>
            </span>
            <span className="text-[10px] text-slate-400">
              Chu kỳ mô phỏng theo {demoScenario}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {analysis.history.map((h) => (
              <div
                key={h.id}
                className="p-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-center space-y-1 shadow-xs"
              >
                <div className="text-[10px] text-slate-400 font-mono">{h.time}</div>
                <div className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                  {h.intervalSec}s
                </div>
                <div className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400">
                  {h.rateMmH} mm/h
                </div>
                <span className={`inline-block text-[9px] px-1.5 py-0.2 rounded border font-medium ${h.badgeClass}`}>
                  {h.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
