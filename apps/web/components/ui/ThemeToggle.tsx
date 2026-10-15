'use client';

import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme, ThemeMode } from '@/app/providers';
import { cn } from '@/lib/utils';

export function ThemeToggle({
  variant = 'compact',
  className
}: {
  variant?: 'compact' | 'segmented' | 'cards';
  className?: string;
}) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  // Compact Header toggle (One-click toggle with tooltip)
  if (variant === 'compact') {
    return (
      <button
        onClick={toggleTheme}
        className={cn(
          'relative w-9 h-9 rounded-xl border border-border bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all duration-200 shadow-sm group',
          className
        )}
        title={resolvedTheme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
        aria-label="Toggle Theme"
      >
        <Sun className="w-4 h-4 text-amber-500 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 absolute" />
        <Moon className="w-4 h-4 text-cyan-400 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 absolute" />
      </button>
    );
  }

  // Segmented Pill (3 options: Sáng / Tối / Tự động)
  if (variant === 'segmented') {
    const options: { mode: ThemeMode; label: string; icon: React.ElementType }[] = [
      { mode: 'light', label: 'Sáng', icon: Sun },
      { mode: 'dark', label: 'Tối', icon: Moon },
      { mode: 'system', label: 'Hệ thống', icon: Laptop }
    ];

    return (
      <div
        className={cn(
          'inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-border text-xs',
          className
        )}
      >
        {options.map((opt) => {
          const Icon = opt.icon;
          const isActive = theme === opt.mode;
          return (
            <button
              key={opt.mode}
              onClick={() => setTheme(opt.mode)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all duration-200',
                isActive
                  ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-300 font-bold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              )}
            >
              <Icon
                className={cn(
                  'w-3.5 h-3.5',
                  opt.mode === 'light' && 'text-amber-500',
                  opt.mode === 'dark' && 'text-cyan-400',
                  opt.mode === 'system' && 'text-purple-400'
                )}
              />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Cards layout (For Settings Page with visual preview cards)
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-3 gap-3', className)}>
      {/* Light Option */}
      <div
        onClick={() => setTheme('light')}
        className={cn(
          'p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-3',
          theme === 'light'
            ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/20 shadow-md ring-2 ring-cyan-500/20'
            : 'border-border bg-card hover:border-slate-300 dark:hover:border-slate-700'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-xs text-slate-800 dark:text-slate-200">
            <Sun className="w-4 h-4 text-amber-500" />
            <span>Giao diện Sáng (Light)</span>
          </div>
          {theme === 'light' && (
            <span className="w-2 h-2 rounded-full bg-cyan-500 ring-4 ring-cyan-500/20" />
          )}
        </div>
        <div className="h-16 rounded-lg bg-slate-100 border border-slate-200 p-2 flex flex-col justify-between">
          <div className="h-2 w-12 bg-slate-300 rounded" />
          <div className="flex gap-1.5">
            <div className="h-6 flex-1 bg-white rounded border border-slate-200" />
            <div className="h-6 flex-1 bg-white rounded border border-slate-200" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">Phù hợp môi trường nhiều ánh sáng tự nhiên</p>
      </div>

      {/* Dark Option */}
      <div
        onClick={() => setTheme('dark')}
        className={cn(
          'p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-3',
          theme === 'dark'
            ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/20 shadow-md ring-2 ring-cyan-500/20'
            : 'border-border bg-card hover:border-slate-300 dark:hover:border-slate-700'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-xs text-slate-800 dark:text-slate-200">
            <Moon className="w-4 h-4 text-cyan-400" />
            <span>Giao diện Tối (Dark - Mặc định)</span>
          </div>
          {theme === 'dark' && (
            <span className="w-2 h-2 rounded-full bg-cyan-500 ring-4 ring-cyan-500/20" />
          )}
        </div>
        <div className="h-16 rounded-lg bg-[#090D16] border border-slate-800 p-2 flex flex-col justify-between">
          <div className="h-2 w-12 bg-slate-700 rounded" />
          <div className="flex gap-1.5">
            <div className="h-6 flex-1 bg-[#111A2E] rounded border border-slate-800" />
            <div className="h-6 flex-1 bg-[#111A2E] rounded border border-slate-800" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">Tối ưu cho bảng điều khiển IoT chuyên nghiệp</p>
      </div>

      {/* System Option */}
      <div
        onClick={() => setTheme('system')}
        className={cn(
          'p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-3',
          theme === 'system'
            ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/20 shadow-md ring-2 ring-cyan-500/20'
            : 'border-border bg-card hover:border-slate-300 dark:hover:border-slate-700'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-xs text-slate-800 dark:text-slate-200">
            <Laptop className="w-4 h-4 text-purple-400" />
            <span>Tự động theo hệ thống (System)</span>
          </div>
          {theme === 'system' && (
            <span className="w-2 h-2 rounded-full bg-cyan-500 ring-4 ring-cyan-500/20" />
          )}
        </div>
        <div className="h-16 rounded-lg bg-gradient-to-r from-slate-100 to-[#090D16] border border-slate-300 dark:border-slate-700 p-2 flex flex-col justify-between">
          <div className="h-2 w-12 bg-slate-400 rounded" />
          <div className="flex gap-1.5">
            <div className="h-6 flex-1 bg-white/80 rounded" />
            <div className="h-6 flex-1 bg-slate-900/80 rounded" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">Đồng bộ tự động theo thiết lập của hệ điều hành</p>
      </div>
    </div>
  );
}
