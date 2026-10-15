'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Cpu,
  Settings,
  Wifi,
  Clock,
  MapPin,
  RotateCw,
  Sliders,
  Terminal,
  Layers
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTimeVi } from '@/lib/utils';

export default function DevicesPage() {
  const queryClient = useQueryClient();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('RS-ESP32S3-01');
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);

  // Form states for config update
  const [nameInput, setNameInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [rainMmPerTipInput, setRainMmPerTipInput] = useState<number>(0.25);
  const [sensorIntervalInput, setSensorIntervalInput] = useState<number>(10);
  const [mqttIntervalInput, setMqttIntervalInput] = useState<number>(30);

  // Fetch device list
  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.getDevices(),
    refetchInterval: 10000
  });

  // Fetch selected device details
  const { data: currentDevice } = useQuery({
    queryKey: ['device', selectedDeviceId],
    queryFn: () => api.getDevice(selectedDeviceId),
    enabled: Boolean(selectedDeviceId)
  });

  // Fetch command audit history
  const { data: commandHistory = [] } = useQuery({
    queryKey: ['deviceCommands', selectedDeviceId],
    queryFn: () => api.getCommands(selectedDeviceId),
    refetchInterval: 3000
  });

  // Mutation to update configuration (Command & Ack workflow)
  const updateConfigMutation = useMutation({
    mutationFn: (configData: any) => api.updateConfig(selectedDeviceId, configData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', selectedDeviceId] });
      queryClient.invalidateQueries({ queryKey: ['deviceCommands', selectedDeviceId] });
      setIsConfigOpen(false);
    }
  });

  // Mutation to send hardware command (e.g. reboot, ping)
  const sendCommandMutation = useMutation({
    mutationFn: (action: string) => api.sendCommand(selectedDeviceId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviceCommands', selectedDeviceId] });
    }
  });

  const handleOpenConfigModal = () => {
    if (currentDevice) {
      setNameInput(currentDevice.name);
      setLocationInput(currentDevice.location);
      setRainMmPerTipInput(currentDevice.configuration?.rainMmPerTip ?? 0.25);
      setSensorIntervalInput(currentDevice.configuration?.sensorInterval ?? 10);
      setMqttIntervalInput(currentDevice.configuration?.mqttInterval ?? 30);
    }
    setIsConfigOpen(true);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfigMutation.mutate({
      name: nameInput,
      location: locationInput,
      rainMmPerTip: Number(rainMmPerTipInput),
      sensorInterval: Number(sensorIntervalInput),
      mqttInterval: Number(mqttIntervalInput)
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Đang tải danh sách thiết bị trạm...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Cpu className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
            <span>Quản Lý Thiết Bị Trạm (Device Management)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Theo dõi trạng thái vi điều khiển ESP32-S3, truyền lệnh OTA và hiệu chuẩn cảm biến qua MQTT
          </p>
        </div>
      </div>

      {/* Device List Table */}
      <section className="bg-card border border-border rounded-2xl p-5 shadow-sm overflow-hidden transition-colors">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span>Danh sách Trạm Quan Trắc Đang Hoạt Động</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-slate-600 dark:text-slate-400 font-semibold bg-slate-50 dark:bg-slate-800/30">
                <th className="py-3 px-4">Mã Trạm (Device ID)</th>
                <th className="py-3 px-4">Tên Trạm</th>
                <th className="py-3 px-4">Vị trí lắp đặt</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4">Firmware</th>
                <th className="py-3 px-4">Wi-Fi (RSSI)</th>
                <th className="py-3 px-4">Nhịp tin cuối</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {devices.map((d: any) => {
                const isSelected = d.deviceId === selectedDeviceId;
                return (
                  <tr
                    key={d.deviceId}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer ${
                      isSelected ? 'bg-cyan-50/70 dark:bg-cyan-500/10' : ''
                    }`}
                    onClick={() => setSelectedDeviceId(d.deviceId)}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-cyan-600 dark:text-cyan-400">
                      {d.deviceId}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-200">
                      {d.name}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{d.location}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${
                          d.isOnline
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${d.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        {d.isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {d.firmwareVersion}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {d.wifiRssi ? `${d.wifiRssi} dBm` : '--'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono">
                      {formatDateTimeVi(d.lastSeen)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDeviceId(d.deviceId);
                          handleOpenConfigModal();
                        }}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-400 border border-slate-300 dark:border-slate-700 rounded-lg font-medium transition-colors inline-flex items-center gap-1.5"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Cấu hình</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Device Details & Hardware Controls */}
      {currentDevice && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Card 1: Thông tin cấu hình chi tiết */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 text-sm">
                <Sliders className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Tham số vận hành phần cứng</span>
              </h3>
              <button
                onClick={handleOpenConfigModal}
                className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline font-semibold"
              >
                Chỉnh sửa
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/40">
                <span className="text-slate-500 dark:text-slate-400">Hệ số hiệu chuẩn mưa:</span>
                <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                  {currentDevice.configuration?.rainMmPerTip ?? 0.25} mm / tip
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/40">
                <span className="text-slate-500 dark:text-slate-400">Chu kỳ đọc cảm biến BME280:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {currentDevice.configuration?.sensorInterval ?? 10} giây
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/40">
                <span className="text-slate-500 dark:text-slate-400">Chu kỳ phát tin MQTT:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {currentDevice.configuration?.mqttInterval ?? 30} giây
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/40">
                <span className="text-slate-500 dark:text-slate-400">Múi giờ trạm:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {currentDevice.timezone}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Lệnh điều khiển trực tiếp (Reboot, Ping) */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 text-sm border-b border-border pb-3">
              <Terminal className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Gửi lệnh điều khiển từ xa (MQTT Command)</span>
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Lệnh được ký định danh qua topic <code className="font-mono text-cyan-600 dark:text-cyan-400">weather/{selectedDeviceId}/command</code> và yêu cầu bản tin xác nhận ACK từ ESP32-S3.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => sendCommandMutation.mutate('ping')}
                disabled={sendCommandMutation.isPending}
                className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Wifi className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Kiểm tra Ping</span>
              </button>

              <button
                onClick={() => sendCommandMutation.mutate('reboot')}
                disabled={sendCommandMutation.isPending}
                className="p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <RotateCw className="w-4 h-4 text-rose-500" />
                <span>Khởi động lại ESP32</span>
              </button>
            </div>
          </div>

          {/* Card 3: Nhật ký lệnh và trạng thái ACK (Command Status) */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3 transition-colors">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 text-sm border-b border-border pb-3">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Nhật ký Lệnh & Phản hồi xác nhận (ACK)</span>
            </h3>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1 text-xs">
              {commandHistory.length === 0 ? (
                <p className="text-slate-500 text-center py-4">Chưa có lệnh nào được gửi.</p>
              ) : (
                commandHistory.slice(0, 5).map((cmd: any) => (
                  <div
                    key={cmd.commandId}
                    className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 uppercase">
                        {cmd.action}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {formatDateTimeVi(cmd.createdAt)}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        cmd.status === 'APPLIED'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                          : cmd.status === 'PENDING'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 animate-pulse'
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {cmd.status === 'APPLIED' ? 'ĐÃ ÁP DỤNG' : cmd.status === 'PENDING' ? 'CHỜ ACK...' : 'THẤT BẠI'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CẤU HÌNH THIẾT BỊ */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <span>Cấu hình Trạm {selectedDeviceId}</span>
              </h2>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-slate-700 dark:text-slate-300">Tên trạm quan trắc:</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-700 dark:text-slate-300">Vị trí địa lý:</label>
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-700 dark:text-slate-300">
                  Hệ số hiệu chuẩn gầu lật mưa (mm/tip):
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.01"
                  max="5.0"
                  value={rainMmPerTipInput}
                  onChange={(e) => setRainMmPerTipInput(parseFloat(e.target.value))}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-cyan-500 text-xs"
                  required
                />
                <p className="text-[11px] text-slate-500">
                  Ví dụ: 0.25 mm/tip (Mặc định Demo), 0.2794 mm/tip (phễu tiêu chuẩn Davis 0.01 inch)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-slate-700 dark:text-slate-300">Đọc cảm biến (giây):</label>
                  <input
                    type="number"
                    min="1"
                    max="3600"
                    value={sensorIntervalInput}
                    onChange={(e) => setSensorIntervalInput(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 font-mono text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-slate-700 dark:text-slate-300">Gửi MQTT (giây):</label>
                  <input
                    type="number"
                    min="5"
                    max="3600"
                    value={mqttIntervalInput}
                    onChange={(e) => setMqttIntervalInput(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 font-mono text-xs"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-700 dark:text-cyan-300">
                Lưu ý: Thay đổi sẽ được gửi đến ESP32-S3 qua MQTT. Trạng thái chỉ chuyển sang &quot;ĐÃ ÁP DỤNG&quot; khi nhận được bản tin xác nhận ACK từ phần cứng.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={updateConfigMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-colors"
                >
                  {updateConfigMutation.isPending ? 'Đang gửi lệnh...' : 'Gửi lệnh lưu cấu hình'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
