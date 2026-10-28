const DEFAULT_REMOTE_BACKEND = 'https://rainsense-backend.onrender.com';

export function getApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim() !== '') {
    // If running in browser on localhost or server-side, respect envUrl
    if (
      typeof window === 'undefined' ||
      !envUrl.includes('localhost') ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    ) {
      return envUrl.replace(/\/+$/, '');
    }
  }

  // When running in client browser on a non-localhost host (e.g. Vercel)
  if (typeof window !== 'undefined') {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return DEFAULT_REMOTE_BACKEND;
    }
  }

  return 'http://localhost:5000';
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    cache: 'no-store'
  });

  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Lỗi khi gọi API (${res.status})`);
  }
  return json.data;
}

export const api = {
  getDashboardSummary: (deviceId?: string) =>
    request<any>(`/api/dashboard/summary${deviceId ? `?deviceId=${deviceId}` : ''}`),

  getDevices: () => request<any[]>('/api/devices'),
  getDevice: (id: string) => request<any>(`/api/devices/${id}`),
  getConfig: (id: string) => request<any>(`/api/devices/${id}/config`),
  updateConfig: (id: string, config: any) =>
    request<any>(`/api/devices/${id}/config`, {
      method: 'PATCH',
      body: JSON.stringify(config)
    }),

  sendCommand: (id: string, action: string, payload?: any) =>
    request<any>(`/api/devices/${id}/command`, {
      method: 'POST',
      body: JSON.stringify({ action, payload })
    }),
  getCommands: (id: string) => request<any[]>(`/api/devices/${id}/commands`),
  resetDeviceData: (id: string) =>
    request<any>(`/api/devices/${id}/reset-data`, { method: 'POST' }),

  getLatest: (id: string) => request<any>(`/api/devices/${id}/latest`),
  getMeasurements: (id: string, range: string = '24h', from?: string, to?: string) => {
    let q = `?range=${range}`;
    if (from) q += `&from=${encodeURIComponent(from)}`;
    if (to) q += `&to=${encodeURIComponent(to)}`;
    return request<any[]>(`/api/devices/${id}/measurements${q}`);
  },
  getEnvironmentalStats: (id: string) => request<any>(`/api/devices/${id}/statistics`),

  getRainfallStats: (id: string) => request<any>(`/api/devices/${id}/rainfall`),
  getHourlyRain: (id: string, hours: number = 24) =>
    request<any[]>(`/api/devices/${id}/hourly-rain?hours=${hours}`),
  getDailyRain: (id: string, days: number = 7) =>
    request<any[]>(`/api/devices/${id}/daily-rain?days=${days}`),

  getAlerts: (deviceId?: string, isRead?: boolean) => {
    let q = '';
    if (deviceId) q += `?deviceId=${deviceId}`;
    if (isRead !== undefined) q += `${q ? '&' : '?'}isRead=${isRead}`;
    return request<any[]>(`/api/alerts${q}`);
  },
  resolveAlert: (id: string) =>
    request<any>(`/api/alerts/${id}/resolve`, { method: 'PATCH' }),

  getAlertRules: (deviceId: string) => request<any[]>(`/api/alerts/rules/${deviceId}`),
  createAlertRule: (rule: any) =>
    request<any>('/api/alerts/rules', { method: 'POST', body: JSON.stringify(rule) }),
  updateAlertRule: (id: string, rule: any) =>
    request<any>(`/api/alerts/rules/${id}`, { method: 'PATCH', body: JSON.stringify(rule) }),

  getDemoMode: () => request<any>('/api/demo/mode'),
  toggleDemoMode: (enable?: boolean) =>
    request<any>('/api/demo/toggle', { method: 'POST', body: JSON.stringify({ enable }) }),
  simulateTip: (count: number = 1) =>
    request<any>('/api/demo/simulate-tip', { method: 'POST', body: JSON.stringify({ count }) }),

  getExportUrl: (deviceId: string, from?: string, to?: string, types?: string[]) => {
    let q = `deviceId=${deviceId}`;
    if (from) q += `&from=${encodeURIComponent(from)}`;
    if (to) q += `&to=${encodeURIComponent(to)}`;
    if (types && types.length) q += `&types=${types.join(',')}`;
    return `${getApiBase()}/api/export?${q}`;
  },

  // RainSense AI Assistant (with multi-tier fallback)
  chatWithAi: async (
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    deviceId: string = 'RS-ESP32S3-01',
    context?: any
  ): Promise<{ reply: string; context: any }> => {
    // 1. Try Next.js local Vercel serverless route first for low latency
    try {
      const localRes = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history, deviceId, context })
      });
      if (localRes.ok) {
        const json = await localRes.json();
        if (json.success && json.data?.reply) {
          return json.data;
        }
      }
    } catch (localErr) {
      // Local route failed, proceed to remote backend
    }

    // 2. Try Render backend directly (/api/ai/chat)
    try {
      return await request<{ reply: string; context: any }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message, history, deviceId })
      });
    } catch (backendErr) {
      // Re-try with local fallback if not already tried
      throw backendErr;
    }
  },

  getAiContext: async (deviceId: string = 'RS-ESP32S3-01'): Promise<any> => {
    // 1. Try local Next.js route first
    try {
      const res = await fetch(`/api/ai/context?deviceId=${encodeURIComponent(deviceId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch (e) {
      // Fall through to backend
    }

    // 2. Try Render backend
    return await request<any>(`/api/ai/context?deviceId=${encodeURIComponent(deviceId)}`);
  }
};
