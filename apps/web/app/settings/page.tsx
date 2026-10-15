'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Server,
  Radio,
  Palette,
  Code2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Cpu
} from 'lucide-react';
import { api } from '@/lib/api';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const { data: demoModeData } = useQuery({
    queryKey: ['demoMode'],
    queryFn: () => api.getDemoMode()
  });

  const toggleDemoMutation = useMutation({
    mutationFn: (enable: boolean) => api.toggleDemoMode(enable),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demoMode'] });
    }
  });

  const resetDataMutation = useMutation({
    mutationFn: () => api.resetDeviceData('RS-ESP32S3-01'),
    onSuccess: (data: any) => {
      setResetMessage(data?.message || 'Đã xóa toàn bộ dữ liệu đo giả lập thành công.');
      queryClient.invalidateQueries();
      setTimeout(() => setResetMessage(null), 5000);
    }
  });

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
          <span>Cài Đặt Hệ Thống & Cấu Hình ESP32-S3 (System Settings)</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Tùy chỉnh giao diện hiển thị, cấu hình phần cứng ESP32-S3, kết nối HiveMQ Cloud và quản lý dữ liệu
        </p>
      </div>

      {/* TÙY CHỌN GIAO DIỆN LIGHT / DARK THEME */}
      <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Palette className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <span>Tùy chỉnh Giao diện Màu sắc (Theme Settings)</span>
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Chuyển đổi tức thì, tự động lưu vào trình duyệt
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          RainSense hỗ trợ đầy đủ <strong>Chế độ Sáng (Light Mode)</strong> hiện đại, <strong>Chế độ Tối (Dark Mode)</strong> chuyên nghiệp dành cho trạm quan trắc IoT, và <strong>Tự động (System)</strong> theo cài đặt của hệ điều hành.
        </p>

        {/* 3 Interactive Cards Selector */}
        <ThemeToggle variant="cards" />
      </section>

      {/* CẤU HÌNH PHẦN CỨNG ESP32-S3 */}
      <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <span>Cấu Hình Phần Cứng ESP32-S3 (Hardware Configuration)</span>
          </h2>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
            RS-ESP32S3-01
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-1">
            <span className="text-slate-500 dark:text-slate-400 block font-semibold">Cảm biến môi trường BME280:</span>
            <span className="font-mono font-bold text-orange-600 dark:text-orange-400">I2C (SDA: GPIO 21, SCL: GPIO 22)</span>
            <span className="text-[11px] text-slate-500 block">Nguồn cấp 3.3V, đo Nhiệt độ, Độ ẩm, Áp suất</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-1">
            <span className="text-slate-500 dark:text-slate-400 block font-semibold">Cảm biến đếm mưa Hall A3144:</span>
            <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">GPIO 4 (Interrupt Edge FALLING)</span>
            <span className="text-[11px] text-slate-500 block">Khử nảy phần cứng Debounce delay 250ms</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-1">
            <span className="text-slate-500 dark:text-slate-400 block font-semibold">Hệ số hiệu chuẩn gầu lật:</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">0.25 mm / nhịp lật (mm/tip)</span>
            <span className="text-[11px] text-slate-500 block">Có thể hiệu chỉnh lại theo dung tích phễu thực tế</span>
          </div>
        </div>
      </section>

      {/* XÓA DỮ LIỆU ĐO (RESET TOÀN BỘ TELEMETRY MẪU) */}
      <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-500" />
            <span>Quản Lý Dữ Liệu & Làm Sạch Hệ Thống (Data Management)</span>
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 text-xs">
          <div className="space-y-1">
            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>Xóa toàn bộ dữ liệu đo giả lập / lịch sử</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
              Xóa sạch các bản tin telemetry, sự kiện mưa và cảnh báo cũ trong cơ sở dữ liệu. Thiết bị sẽ chuyển về trạng thái sẵn sàng đón nhận dữ liệu thực tế từ ESP32-S3.
            </p>
          </div>

          <button
            onClick={() => {
              if (confirm('Bạn có chắc chắn muốn xóa toàn bộ dữ liệu đo và đưa hệ thống về trạng thái ban đầu?')) {
                resetDataMutation.mutate();
              }
            }}
            disabled={resetDataMutation.isPending}
            className="px-4 py-2.5 rounded-xl font-bold transition-all bg-rose-600 hover:bg-rose-500 text-white shrink-0 disabled:opacity-50"
          >
            {resetDataMutation.isPending ? 'Đang xóa...' : 'Xóa sạch dữ liệu đo'}
          </button>
        </div>

        {resetMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>{resetMessage}</span>
          </div>
        )}
      </section>

      {/* Operation Mode */}
      <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Radio className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          <span>Chế độ hoạt động hệ thống (System Operational Mode)</span>
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-xs transition-colors">
          <div>
            <div className="font-bold text-slate-900 dark:text-slate-200 text-sm mb-1 flex items-center gap-2">
              <span>Chế độ hiện tại:</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                  demoModeData?.mode === 'DEMO'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {demoModeData?.mode === 'DEMO' ? 'DEMO MODE (Giả lập phần cứng)' : 'LIVE MODE (Dữ liệu phần cứng ESP32-S3)'}
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong>LIVE MODE (Hiện tại):</strong> Máy chủ chỉ tiếp nhận dữ liệu từ các bản tin MQTT thực tế được vi điều khiển ESP32-S3 gửi qua HiveMQ Cloud.
              <br />
              <strong>DEMO MODE:</strong> Máy chủ tự động phát dữ liệu mô phỏng để xem trước khi chưa có phần cứng.
            </p>
          </div>

          <button
            onClick={() => toggleDemoMutation.mutate(demoModeData?.mode !== 'DEMO')}
            className={`px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 ${
              demoModeData?.mode === 'DEMO'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            {demoModeData?.mode === 'DEMO' ? 'Chuyển sang LIVE MODE' : 'Bật DEMO MODE'}
          </button>
        </div>
      </section>

      {/* Cloud & IoT Connectivity Status */}
      <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Server className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <span>Thông số kết nối Broker MQTT (HiveMQ Cloud TLS)</span>
        </h2>

        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-1">
              <span className="text-slate-500 dark:text-slate-400 block">Địa chỉ Broker (HiveMQ Cloud):</span>
              <span className="font-mono font-bold text-cyan-600 dark:text-cyan-300">tls://cluster-id.s1.eu.hivemq.cloud:8883</span>
              <span className="text-[10px] text-slate-500 block">Cổng TLS mã hóa bảo mật 8883 (hoặc port 1883 nếu Mosquitto local)</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-1">
              <span className="text-slate-500 dark:text-slate-400 block">Cơ sở dữ liệu (Database Host):</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-300">PostgreSQL (NeonDB Cloud Serverless)</span>
              <span className="text-[10px] text-slate-500 block">Prisma ORM với tính năng khử lặp bản tin idempotent</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 space-y-2">
            <span className="font-semibold text-slate-800 dark:text-slate-200 block">Các Topic MQTT chuẩn của ESP32-S3:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="p-2 bg-white dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300">
                <span className="text-cyan-600 dark:text-cyan-400 font-bold">weather/RS-ESP32S3-01/telemetry</span>: BME280 định kỳ
              </div>
              <div className="p-2 bg-white dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300">
                <span className="text-cyan-600 dark:text-cyan-400 font-bold">weather/RS-ESP32S3-01/rain</span>: Sự kiện lật gầu Hall A3144
              </div>
              <div className="p-2 bg-white dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300">
                <span className="text-cyan-600 dark:text-cyan-400 font-bold">weather/RS-ESP32S3-01/status</span>: LWT / Online Heartbeat
              </div>
              <div className="p-2 bg-white dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300">
                <span className="text-cyan-600 dark:text-cyan-400 font-bold">weather/RS-ESP32S3-01/command</span>: Lệnh điều khiển từ xa
              </div>
              <div className="p-2 bg-white dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300">
                <span className="text-cyan-600 dark:text-cyan-400 font-bold">weather/RS-ESP32S3-01/command/ack</span>: Phản hồi xác nhận lệnh
              </div>
              <div className="p-2 bg-white dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300">
                <span className="text-cyan-600 dark:text-cyan-400 font-bold">weather/RS-ESP32S3-01/config</span>: Đồng bộ tham số cấu hình
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Firmware Contract Documentation Reference */}
      <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3 transition-colors">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Code2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span>Tài liệu Kỹ thuật & Mã nguồn Nạp ESP32-S3</span>
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Mã nguồn firmware mẫu hoàn chỉnh cho ESP32-S3, sơ đồ đấu nối chân cảm biến BME280 (I2C) và cảm biến Hall A3144 (GPIO Interrupt) được lưu trữ chi tiết trong thư mục <code className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">docs/ESP32_FIRMWARE_GUIDE.md</code> và <code className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">docs/MQTT_SPECIFICATION.md</code>.
        </p>
      </section>
    </div>
  );
}
