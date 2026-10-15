# RainSense — ESP32-S3 Hardware Wiring & Firmware Guide

This guide details the hardware assembly, circuit diagram, and complete production firmware for the **RainSense** weather station using an **ESP32-S3**, **BME280** environmental sensor, and **A3144 Hall Effect Sensor** with a tipping bucket rain gauge.

---

## 1. Hardware Pinout & Wiring Diagram

```
                 +-----------------------------+
                 |       ESP32-S3 WROOM        |
                 |                             |
  3.3V (Out) ----+ 3V3                         |
  GND -----------+ GND                         |
                 |                             |
  GPIO 21 -------+ SDA (I2C Bus)               |
  GPIO 22 -------+ SCL (I2C Bus)               |
                 |                             |
  GPIO 4 --------+ GPIO4 (Interrupt Edge FALL) |
                 +-----------------------------+
```

### Pin Connections:

| Module | Pin | ESP32-S3 Pin | Notes |
|---|---|---|---|
| **BME280** | VCC | 3V3 | Regulated 3.3V DC (Do NOT connect to 5V) |
| **BME280** | GND | GND | Common Ground |
| **BME280** | SCL | GPIO 22 | I2C Clock (SCL) |
| **BME280** | SDA | GPIO 21 | I2C Data (SDA) |
| **A3144 Hall Sensor** | VCC (Pin 1) | 3V3 | Power supply |
| **A3144 Hall Sensor** | GND (Pin 2) | GND | Ground |
| **A3144 Hall Sensor** | OUT (Pin 3) | GPIO 4 | Open-drain output with 10k pull-up to 3.3V |

> [!TIP]
> **Debounce Filter for Tipping Bucket:**
> Place a 100nF ceramic capacitor between GPIO 4 and GND, and a 10kΩ pull-up resistor between GPIO 4 and 3.3V to eliminate magnetic contact bounce.

---

## 2. Production Firmware (`RainSense_ESP32S3.ino`)

The firmware below compiles in Arduino IDE or PlatformIO for **ESP32-S3 Dev Module**.

```cpp
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <ArduinoJson.h>

// --------------------------------------------------------------------------
// 1. CONFIGURATION PARAMETERS
// --------------------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASS     = "YOUR_WIFI_PASSWORD";

// HiveMQ Cloud MQTT Broker (TLS Port 8883)
const char* MQTT_HOST     = "your-cluster-id.s1.eu.hivemq.cloud";
const int   MQTT_PORT     = 8883;
const char* MQTT_USER     = "rainsense_station_user";
const char* MQTT_PASS     = "YourStrongPassword";

const char* DEVICE_ID     = "RS-ESP32S3-01";
const char* FIRMWARE_VER  = "1.2.0-prod";

#define RAIN_PIN          4        // Hall Effect Sensor A3144 interrupt pin
#define I2C_SDA           21
#define I2C_SCL           22

// Timing configurations
unsigned long mqttIntervalMs   = 30000;   // 30 seconds default
unsigned long lastMqttSend     = 0;
unsigned long lastDebounceTime = 0;
const unsigned long DEBOUNCE_DELAY_MS = 250; // Ignore pulses < 250ms apart

// Calibration (mm per tip)
float rainMmPerTip = 0.25;

// Global counters
volatile uint32_t totalRainTips = 0;
uint32_t sequenceNumber = 0;
String bootId = "";

// Hardware objects
Adafruit_BME280 bme;
WiFiClientSecure secureClient;
PubSubClient mqttClient(secureClient);

// --------------------------------------------------------------------------
// 2. HARDWARE INTERRUPT SERVICE ROUTINE (ISR)
// --------------------------------------------------------------------------
void IRAM_ATTR onRainBucketTip() {
  unsigned long now = millis();
  if ((now - lastDebounceTime) > DEBOUNCE_DELAY_MS) {
    totalRainTips++;
    lastDebounceTime = now;
  }
}

// --------------------------------------------------------------------------
// 3. MQTT COMMAND & CONFIG CALLBACK
// --------------------------------------------------------------------------
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  if (error) return;

  const char* action = doc["action"];
  const char* commandId = doc["commandId"];

  // Process command
  if (strcmp(action, "set_config") == 0) {
    if (doc["payload"]["rainMmPerTip"].is<float>()) {
      rainMmPerTip = doc["payload"]["rainMmPerTip"];
    }
    if (doc["payload"]["mqttInterval"].is<int>()) {
      mqttIntervalMs = doc["payload"]["mqttInterval"].as<unsigned long>() * 1000;
    }

    // Send ACK back to server
    StaticJsonDocument<256> ack;
    ack["commandId"] = commandId;
    ack["deviceId"] = DEVICE_ID;
    ack["status"] = "SUCCESS";
    ack["message"] = "Cau hinh luu thanh cong tren ESP32-S3";
    ack["timestamp"] = getIsoTimestamp();

    char ackBuffer[256];
    serializeJson(ack, ackBuffer);
    String ackTopic = String("weather/") + DEVICE_ID + "/command/ack";
    mqttClient.publish(ackTopic.c_str(), ackBuffer, false);
  } 
  else if (strcmp(action, "reboot") == 0) {
    ESP.restart();
  }
}

// Helper to format ISO timestamp
String getIsoTimestamp() {
  // Uses NTP or system epoch
  time_t now = time(nullptr);
  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

// --------------------------------------------------------------------------
// 4. SETUP & INITIALIZATION
// --------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);

  // Generate unique boot session ID
  bootId = "boot-" + String((uint32_t)ESP.getEfuseMac(), HEX);

  // Setup I2C & BME280
  Wire.begin(I2C_SDA, I2C_SCL);
  if (!bme.begin(0x76, &Wire) && !bme.begin(0x77, &Wire)) {
    Serial.println("Warning: BME280 sensor not detected. Check I2C wiring.");
  }

  // Setup Hall Effect sensor pin with internal pull-up and ISR
  pinMode(RAIN_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(RAIN_PIN), onRainBucketTip, FALLING);

  // Connect Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  // Sync NTP Time
  configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");

  // Secure TLS configuration
  secureClient.setInsecure(); // Or inject HiveMQ root CA certificate for strict pin

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  mqttClient.setBufferSize(1024);
}

// --------------------------------------------------------------------------
// 5. MAIN LOOP
// --------------------------------------------------------------------------
void loop() {
  if (!mqttClient.connected()) {
    reconnectMqtt();
  }
  mqttClient.loop();

  unsigned long now = millis();
  if (now - lastMqttSend >= mqttIntervalMs) {
    lastMqttSend = now;
    publishTelemetry();
  }
}

void reconnectMqtt() {
  while (!mqttClient.connected()) {
    String clientId = String(DEVICE_ID) + "-" + String(random(0xffff), HEX);
    String lwtTopic = String("weather/") + DEVICE_ID + "/status";
    String lwtPayload = "{\"deviceId\":\"" + String(DEVICE_ID) + "\",\"status\":\"offline\"}";

    if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS, lwtTopic.c_str(), 1, true, lwtPayload.c_str())) {
      // Publish Online status
      String statusTopic = String("weather/") + DEVICE_ID + "/status";
      String statusPayload = "{\"deviceId\":\"" + String(DEVICE_ID) + "\",\"status\":\"online\",\"firmwareVersion\":\"" + String(FIRMWARE_VER) + "\"}";
      mqttClient.publish(statusTopic.c_str(), statusPayload.c_str(), true);

      // Subscribe to command topic
      String cmdTopic = String("weather/") + DEVICE_ID + "/command";
      mqttClient.subscribe(cmdTopic.c_str(), 1);
    } else {
      delay(5000);
    }
  }
}

void publishTelemetry() {
  sequenceNumber++;
  float temp = bme.readTemperature();
  float humid = bme.readHumidity();
  float press = bme.readPressure() / 100.0F; // Pa to hPa

  StaticJsonDocument<512> doc;
  doc["messageId"] = String(DEVICE_ID) + "-" + bootId + "-" + String(sequenceNumber);
  doc["deviceId"] = DEVICE_ID;
  doc["bootId"] = bootId;
  doc["sequenceNumber"] = sequenceNumber;
  doc["timestamp"] = getIsoTimestamp();
  doc["temperature"] = round(temp * 10) / 10.0;
  doc["humidity"] = round(humid * 10) / 10.0;
  doc["pressure"] = round(press * 10) / 10.0;
  doc["totalRainTips"] = totalRainTips;
  doc["rainRate"] = 0.0;
  doc["wifiRssi"] = WiFi.RSSI();
  doc["uptime"] = millis() / 1000;
  doc["firmwareVersion"] = FIRMWARE_VER;

  char buffer[512];
  serializeJson(doc, buffer);
  String topic = String("weather/") + DEVICE_ID + "/telemetry";
  mqttClient.publish(topic.c_str(), buffer, false);
}
```
