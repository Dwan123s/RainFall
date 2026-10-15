import { dataStore } from '../db/store';

export class ExportService {
  /**
   * Export telemetry measurements to CSV format
   */
  async exportCsv(
    deviceId: string,
    from?: string,
    to?: string,
    types: string[] = ['temperature', 'humidity', 'pressure', 'rain']
  ): Promise<string> {
    const measurements = await dataStore.getMeasurements(deviceId, {
      from,
      to,
      limit: 10000
    });

    const headers = ['Timestamp', 'Station ID', 'Message ID'];
    if (types.includes('temperature')) headers.push('Temperature (°C)', 'Dew Point (°C)');
    if (types.includes('humidity')) headers.push('Humidity (%)');
    if (types.includes('pressure')) headers.push('Pressure (hPa)');
    if (types.includes('rain')) headers.push('Rain Rate (mm/h)', 'Total Tips');
    headers.push('WiFi RSSI (dBm)', 'Uptime (s)');

    const rows: string[] = [headers.join(',')];

    for (const m of measurements) {
      const col: (string | number)[] = [
        `"${m.timestamp}"`,
        `"${m.deviceId}"`,
        `"${m.messageId}"`
      ];

      if (types.includes('temperature')) {
        col.push(m.temperature);
        col.push(m.dewPoint ?? '');
      }
      if (types.includes('humidity')) {
        col.push(m.humidity);
      }
      if (types.includes('pressure')) {
        col.push(m.pressure);
      }
      if (types.includes('rain')) {
        col.push(m.rainRate ?? 0);
        col.push(m.totalRainTips ?? 0);
      }
      col.push(m.wifiRssi);
      col.push(m.uptime);

      rows.push(col.join(','));
    }

    return rows.join('\r\n');
  }
}

export const exportService = new ExportService();
