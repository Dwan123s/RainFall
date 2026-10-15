'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Radio,
  Wifi,
  Droplets,
  User
} from 'lucide-react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export function Header({
  selectedStation = 'RS-ESP32S3-01',
  onSelectStation
}: {
  selectedStation?: string;
  onSelectStation?: (id: string) => void;
}) {
  const queryClient = useQueryClient();

  const [currentTime, setCurrentTime] = useState<string>('');
  const [socketConnected, setSocketConnected] = useState<boolean>(false);

  // Clock ticker in Vietnam timezone
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        new Intl.DateTimeFormat('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }).format(now)
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Socket.IO connection monitoring
  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    if (socket.connected) setSocketConnected(true);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // Fetch stations for dropdown
  const { data: devices } = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.getDevices(),
  });

  // Fetch demo mode status
  const { data: demoModeData } = useQuery({
    queryKey: ['demoMode'],
    queryFn: () => api.getDemoMode(),
  });

  const isDemoMode = demoModeData?.mode === 'DEMO';

  // Toggle demo mode mutation
  const toggleDemoMutation = useMutation({
    mutationFn: (enable: boolean) => api.toggleDemoMode(enable),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demoMode'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    }
  });

  // Trigger simulated rain tip
  const simulateTipMutation = useMutation({
    mutationFn: (count: number) => api.simulateTip(count),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      queryClient.invalidateQueries({ queryKey: ['rainfall'] });
    }
  });

  return (
    <header className="h-16 px-6 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-20 transition-colors">
      {/* Station Selector & Breadcrumb */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="station-select" className="text-xs text-slate-500 dark:text-slate-400 font-medium">Trạm:</label>
          <select
            id="station-select"
            value={selectedStation}
            onChange={(e) => onSelectStation?.(e.target.value)}
            className="bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-border text-sm font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 text-slate-800 dark:text-slate-200 transition-colors"
          >
            {devices && devices.length > 0 ? (
              devices.map((d: any) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.name} ({d.deviceId})
                </option>
              ))
            ) : (
              <option value="RS-ESP32S3-01">RS-ESP32S3-01 (Mặc định)</option>
            )}
          </select>
        </div>

        {/* Real-time WebSocket connection state */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 text-xs transition-colors">
          <span
            className={`w-2 h-2 rounded-full ${
              socketConnected ? 'bg-emerald-500 animate-pulse-live' : 'bg-rose-500'
            }`}
          />
          <span className="text-[11px] font-mono text-slate-700 dark:text-slate-300">
            {socketConnected ? 'Realtime Live' : 'Mất kết nối WS'}
          </span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Date and Time */}
        <div className="hidden md:block text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/30 px-2.5 py-1 rounded border border-slate-200 dark:border-border transition-colors">
          {currentTime || 'Đang tải giờ...'}
        </div>

        {/* DEMO MODE / LIVE MODE Switcher Pill */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-1 rounded-lg transition-colors">
          <button
            onClick={() => toggleDemoMutation.mutate(!isDemoMode)}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
              isDemoMode
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 shadow-sm'
            }`}
            title="Nhấn để chuyển đổi giữa DEMO MODE và LIVE MODE"
          >
            <Radio className="w-3 h-3 animate-pulse" />
            <span>{isDemoMode ? 'DEMO MODE' : 'LIVE MODE'}</span>
          </button>

          {isDemoMode && (
            <button
              onClick={() => simulateTipMutation.mutate(1)}
              disabled={simulateTipMutation.isPending}
              className="px-2 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 rounded text-xs flex items-center gap-1 transition-colors"
              title="Kích hoạt 1 xung lật gầu Hall A3144 (0.25mm)"
            >
              <Droplets className="w-3 h-3 text-cyan-500 dark:text-cyan-400" />
              <span className="hidden sm:inline font-medium">Thử nhịp mưa</span>
            </button>
          )}
        </div>

        {/* Theme Toggle Component */}
        <ThemeToggle variant="compact" />

        {/* User Icon */}
        <div className="w-9 h-9 rounded-xl border border-border bg-slate-100 dark:bg-slate-800/40 flex items-center justify-center text-slate-700 dark:text-slate-300 font-medium text-xs transition-colors shadow-sm">
          <User className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
        </div>
      </div>
    </header>
  );
}
