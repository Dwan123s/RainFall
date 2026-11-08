import { getApiBase } from './api';
import { normalizeStationContext } from './rainsense-ai';

export function getAiBackendBase(): string {
  if (process.env.AI_BACKEND_URL?.trim()) return process.env.AI_BACKEND_URL.trim().replace(/\/+$/, '');
  return !process.env.NEXT_PUBLIC_API_URL?.trim() && process.env.NODE_ENV === 'production'
    ? 'https://rainsense-backend-dlxg.onrender.com' : getApiBase();
}

/** Fetch authoritative data server-side instead of promoting client text into station readings. */
export async function fetchStationContext(deviceId: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const backend = getAiBackendBase();
    const response = await fetch(`${backend}/api/ai/context?deviceId=${encodeURIComponent(deviceId)}`,
      { signal: controller.signal, cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data?.deviceId === deviceId) return normalizeStationContext(data.data, deviceId);
    }
  } catch { /* Missing data is reported explicitly when backend cannot be reached. */ }
  finally { clearTimeout(timeout); }
  return normalizeStationContext(null, deviceId);
}
