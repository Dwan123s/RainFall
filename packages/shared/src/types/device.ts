export interface DeviceRecord {
  id: string;
  deviceId: string;
  name: string;
  location: string;
  timezone: string; // e.g. "Asia/Ho_Chi_Minh"
  firmwareVersion: string;
  lastSeen?: string;
  isOnline: boolean;
  wifiRssi?: number;
  uptime?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceConfigurationRecord {
  id: string;
  deviceId: string;
  rainMmPerTip: number; // Configurable per station (e.g. 0.25 mm/tip)
  sensorInterval: number; // Seconds between sensor readings
  mqttInterval: number; // Seconds between MQTT publications
  updatedAt: string;
}

export type CommandAction = 'reboot' | 'set_config' | 'calibrate_rain' | 'ping';

export type CommandStatus = 'PENDING' | 'APPLIED' | 'FAILED' | 'TIMED_OUT';

export interface DeviceCommandRecord {
  id: string;
  deviceId: string;
  commandId: string;
  action: CommandAction;
  payload: Record<string, unknown>;
  status: CommandStatus;
  createdAt: string;
  acknowledgedAt?: string;
  errorMessage?: string;
}

export interface DeviceCommandPayload {
  commandId: string;
  deviceId: string;
  action: CommandAction;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface DeviceCommandAckPayload {
  commandId: string;
  deviceId: string;
  status: 'SUCCESS' | 'FAILED';
  message?: string;
  timestamp: string;
}
