# RainSense — MQTT Integration Specification

## 1. Overview & Connection Architecture

The RainSense IoT platform communicates with environmental monitoring stations (ESP32-S3) via **MQTT over TLS (Port 8883)** using the **HiveMQ Cloud MQTT Broker**.

```
+------------------+         MQTTS (TLS 8883)         +--------------------+         Socket.IO         +------------------+
|  ESP32-S3 Node   | ===============================> |  HiveMQ Cloud      | ------------------------> |  RainSense Web   |
| (BME280 + A3144) | <=============================== |  Node.js Backend   |                           |  Next.js App     |
+------------------+        QoS 1, Idempotent         +--------------------+                           +------------------+
```

### Broker Connection Parameters
- **Broker Host:** `<your-cluster-id>.s1.eu.hivemq.cloud`
- **Port:** `8883` (MQTTS - TLS Encrypted)
- **Authentication:** Username + Password (Server-side & Hardware provisioned)
- **Protocol:** MQTT v3.1.1 / v5.0
- **Clean Session:** `true`

---

## 2. Topic Architecture

All topics are prefixed by `weather/{deviceId}/`:

| Topic | Publisher | QoS | Retain | Description |
|---|---|---|---|---|
| `weather/{deviceId}/telemetry` | ESP32-S3 | 1 | No | Periodic telemetry (temp, humidity, pressure, cumulative tips) |
| `weather/{deviceId}/rain` | ESP32-S3 | 1 | No | Event-triggered bucket tip pulses (Hall effect sensor) |
| `weather/{deviceId}/status` | ESP32-S3 | 1 | Yes | Online heartbeat & Last Will and Testament (LWT) |
| `weather/{deviceId}/command` | Backend | 1 | No | Remote control commands (reboot, set_config, ping) |
| `weather/{deviceId}/command/ack` | ESP32-S3 | 1 | No | Firmware acknowledgment for command execution |
| `weather/{deviceId}/config` | Backend | 1 | Yes | Synchronized station configuration parameters |

---

## 3. Payload Contracts (JSON Schemas)

### A. Periodic Telemetry (`weather/{deviceId}/telemetry`)
Published every `mqttInterval` seconds (e.g. 30 seconds).

```json
{
  "messageId": "RS-ESP32S3-01-1728739200-0042",
  "deviceId": "RS-ESP32S3-01",
  "bootId": "boot-9f82d1",
  "sequenceNumber": 42,
  "timestamp": "2026-10-12T09:00:00.000Z",
  "temperature": 29.4,
  "humidity": 68.5,
  "pressure": 1011.8,
  "totalRainTips": 18,
  "rainRate": 0.0,
  "wifiRssi": -63,
  "uptime": 1260,
  "firmwareVersion": "1.2.0-prod",
  "batteryVoltage": 4.15
}
```

#### Field Specifications:
- `messageId` *(string, required)*: Globally unique identifier for message deduplication (`{deviceId}-{bootId}-{seq}`).
- `deviceId` *(string, required)*: Hardware station ID.
- `bootId` *(string, required)*: Random session UUID created upon ESP32 boot.
- `sequenceNumber` *(integer, required)*: Incrementing 32-bit counter reset only on power cycle.
- `temperature` *(float, required)*: Dry-bulb air temperature in °C from BME280 (-40.0 to 85.0).
- `humidity` *(float, required)*: Relative humidity percentage in % from BME280 (0.0 to 100.0).
- `pressure` *(float, required)*: Atmospheric pressure in hPa from BME280 (300.0 to 1200.0).
- `totalRainTips` *(integer, required)*: Monotonically increasing cumulative tipping bucket count.
- `rainRate` *(float, required)*: Rain intensity in mm/h computed over recent window.
- `wifiRssi` *(integer, required)*: Wi-Fi Received Signal Strength Indication in dBm (-100 to 0).
- `uptime` *(integer, required)*: Seconds elapsed since boot.

---

### B. Instantaneous Rain Event (`weather/{deviceId}/rain`)
Published immediately when the tipping bucket tips (debounced Hall effect interrupt).

```json
{
  "messageId": "RS-ESP32S3-01-rain-1728739245",
  "deviceId": "RS-ESP32S3-01",
  "bootId": "boot-9f82d1",
  "sequenceNumber": 43,
  "timestamp": "2026-10-12T09:00:45.000Z",
  "tipCount": 1,
  "cumulativeTips": 19,
  "durationMs": 4200,
  "instantIntensityMmH": 21.4
}
```

---

### C. Station Status & LWT (`weather/{deviceId}/status`)
Configured as MQTT Last Will and Testament (LWT) when connecting to broker:

**LWT Configuration:**
- Topic: `weather/{deviceId}/status`
- Payload:
  ```json
  {
    "deviceId": "RS-ESP32S3-01",
    "status": "offline",
    "timestamp": "2026-10-12T09:00:00.000Z",
    "reason": "LWT Broker Disconnect"
  }
  ```
- Retain: `true`
- QoS: `1`

**Online Heartbeat Payload:**
```json
{
  "deviceId": "RS-ESP32S3-01",
  "status": "online",
  "timestamp": "2026-10-12T08:00:00.000Z",
  "uptime": 10,
  "wifiRssi": -62,
  "firmwareVersion": "1.2.0-prod"
}
```

---

### D. Remote Command (`weather/{deviceId}/command`)
Sent by Backend to ESP32:

```json
{
  "commandId": "cmd-cfg-1728739300",
  "deviceId": "RS-ESP32S3-01",
  "action": "set_config",
  "payload": {
    "rainMmPerTip": 0.25,
    "sensorInterval": 10,
    "mqttInterval": 30
  },
  "timestamp": "2026-10-12T09:01:40.000Z"
}
```

---

### E. Command Acknowledgment (`weather/{deviceId}/command/ack`)
Sent by ESP32 firmware back to backend after executing the command:

```json
{
  "commandId": "cmd-cfg-1728739300",
  "deviceId": "RS-ESP32S3-01",
  "status": "SUCCESS",
  "message": "Cấu hình đã được lưu vào EEPROM của ESP32-S3 thành công",
  "timestamp": "2026-10-12T09:01:41.500Z"
}
```
