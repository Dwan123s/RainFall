'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CloudRain,
  ThermometerSun,
  Cpu,
  Bell,
  History,
  Settings,
  CloudLightning,
  ChevronRight,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { name: 'Tổng quan', href: '/overview', icon: LayoutDashboard },
  { name: 'Phân tích lượng mưa', href: '/rainfall', icon: CloudRain },
  { name: 'Phân tích môi trường', href: '/environmental', icon: ThermometerSun },
  { name: 'Quản lý thiết bị', href: '/devices', icon: Cpu },
  { name: 'Cảnh báo & Sự kiện', href: '/alerts', icon: Bell },
  { name: 'Dữ liệu lịch sử', href: '/history', icon: History },
  { name: 'Cài đặt hệ thống', href: '/settings', icon: Settings },
];

interface SidebarProps {
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ className, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (isMobile: boolean) => (
    <div className="flex flex-col h-full justify-between">
      <div>
        {/* Brand Logo & Station Title */}
        <div className="h-16 px-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-glow-cyan">
              <CloudLightning className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="font-bold text-base tracking-wide bg-gradient-to-r from-cyan-600 to-sky-500 dark:from-cyan-400 dark:to-sky-200 bg-clip-text text-transparent">
                RainSense
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tracking-wider uppercase">
                IoT Weather Station
              </div>
            </div>
          </div>

          {/* Close button on mobile */}
          {isMobile && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Đóng menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/overview' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (isMobile) onClose?.();
                }}
                className={cn(
                  'flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all group',
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      'w-4 h-4 transition-transform group-hover:scale-110',
                      isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-400'
                    )}
                  />
                  <span>{item.name}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Station Hardware Badge in Sidebar Footer */}
      <div className="p-4 border-t border-border bg-slate-100/60 dark:bg-slate-900/40 text-xs transition-colors">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">ESP32-S3 Core</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-mono">
            BME280 + A3144
          </span>
        </div>
        <p className="text-[11px] text-slate-500 line-clamp-1">
          Giao thức MQTT / EMQX Cloud TLS
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Cố định ở màn hình từ md trở lên) */}
      <aside
        className={cn(
          'hidden md:flex w-64 border-r border-border bg-card/80 backdrop-blur-md flex-col justify-between shrink-0 select-none z-30 transition-all duration-300',
          className
        )}
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile Drawer (Trượt ra trên màn hình nhỏ < md) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop overlay mờ nền đen */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer Sidebar */}
          <aside className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-card border-r border-border shadow-2xl z-50 flex flex-col justify-between animate-in slide-in-from-left duration-300">
            {sidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  );
}
