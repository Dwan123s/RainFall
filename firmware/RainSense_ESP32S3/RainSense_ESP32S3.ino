/*
 * ==============================================================================
 * RainSense — Smart Rainfall & Environmental Monitoring Station
 * Hardware: ESP32-S3 Dev Module + BME280 (I2C) + A3144 Hall Effect Sensor
 * Protocol: MQTT over TLS (Port 8883) via HiveMQ Cloud
 * ==============================================================================
 * 
 * LƯU Ý KẾT NỐI CHÂN PHẦN CỨNG (PINOUT):
 * 1. BME280 (Cảm biến nhiệt độ, độ ẩm, khí áp):
 *    - VCC -> 3V3 (Không cắm 5V)
 *    - GND -> GND
 *    - SDA -> GPIO 21
 *    - SCL -> GPIO 22
 * 
 * 2. Cảm biến Hall A3144 (Gầu lật đo mưa):
 *    - VCC (Chân 1) -> 3V3
 *    - GND (Chân 2) -> GND
 *    - OUT (Chân 3) -> GPIO 4 (Kèm trở kéo lên 10k lên 3.3V, tụ 100nF lọc nảy tiếp điểm)
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <ArduinoJson.h>

// --------------------------------------------------------------------------
// 1. CẤU HÌNH THÔNG SỐ WI-FI & HIVEMQ CLOUD MQTT
// --------------------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";             // Nhập tên Wi-Fi
const char* WIFI_PASS     = "YOUR_WIFI_PASSWORD";         // Nhập mật khẩu Wi-Fi

// HiveMQ Cloud Broker (Cluster URL của bạn trên console.hivemq.cloud)
const char* MQTT_HOST     = "your-cluster-id.s1.eu.hivemq.cloud"; 
const int   MQTT_PORT     = 8883;                         // Cổng TLS bảo mật 8883
const char* MQTT_USER     = "rainsense_station_user";     // Tên tài khoản MQTT
const char* MQTT_PASS     = "YourStrongPassword";         // Mật khẩu MQTT

// Định danh trạm ESP32-S3 (Phải khớp với cấu hình hệ thống RainSense)
const char* DEVICE_ID     = "RS-ESP32S3-01";
const char* FIRMWARE_VER  = "1.2.0-prod";

// Định nghĩa chân phần cứng ESP32-S3
#define RAIN_PIN          4        // Chân ngắt cảm biến Hall A3144
#define I2C_SDA           21       // Chân SDA của BME280
#define I2C_SCL           22       // Chân SCL của BME280

// Chu kỳ truyền tin mặc định (30 giây)
unsigned long mqttIntervalMs   = 30000;
unsigned long lastMqttSend     = 0;
unsigned long lastDebounceTime = 0;
const unsigned long DEBOUNCE_DELAY_MS = 250; // Khử nảy ngắt từ tính (< 250ms)

// Hệ số hiệu chuẩn gầu lật (0.25 mm/tip mặc định)
float rainMmPerTip = 0.25;

// Các biến toàn cục đếm xung
volatile uint32_t totalRainTips = 0;
uint32_t sequenceNumber = 0;
String bootId = "";

// Đối tượng phần cứng
Adafruit_BME280 bme;
WiFiClientSecure secureClient;
PubSubClient mqttClient(secureClient);

// --------------------------------------------------------------------------
// 2. NGẮT PHẦN CỨNG GẦU LẬP (HARDWARE ISR)
// --------------------------------------------------------------------------
void IRAM_ATTR onRainBucketTip() {
  unsigned long now = millis();
  if ((now - lastDebounceTime) > DEBOUNCE_DELAY_MS) {
    totalRainTips++;
    lastDebounceTime = now;
  }
}

// Helper lấy thời gian ISO 8601 qua NTP
String getIsoTimestamp() {
  time_t now = time(nullptr);
  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

// --------------------------------------------------------------------------
// 3. XỬ LÝ LỆNH TỪ XA TỪ MÁY CHỦ (MQTT COMMAND CALLBACK)
// --------------------------------------------------------------------------
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  if (error) return;

  const char* action = doc["action"];
  const char* commandId = doc["commandId"];

  // 1. Lệnh cập nhật cấu hình tham số
  if (strcmp(action, "set_config") == 0) {
    if (doc["payload"]["rainMmPerTip"].is<float>()) {
      rainMmPerTip = doc["payload"]["rainMmPerTip"];
    }
    if (doc["payload"]["mqttInterval"].is<int>()) {
      mqttIntervalMs = doc["payload"]["mqttInterval"].as<unsigned long>() * 1000;
    }

    // Gửi bản tin xác nhận ACK về máy chủ
    StaticJsonDocument<256> ack;
    ack["commandId"] = commandId;
    ack["deviceId"] = DEVICE_ID;
    ack["status"] = "SUCCESS";
    ack["message"] = "Cấu hình đã áp dụng thành công trên ESP32-S3";
    ack["timestamp"] = getIsoTimestamp();

    char ackBuffer[256];
    serializeJson(ack, ackBuffer);
    String ackTopic = String("weather/") + DEVICE_ID + "/command/ack";
    mqttClient.publish(ackTopic.c_str(), ackBuffer, false);
  } 
  // 2. Lệnh khởi động lại từ xa
  else if (strcmp(action, "reboot") == 0) {
    ESP.restart();
  }
  // 3. Lệnh Ping kiểm tra độ trễ mạng
  else if (strcmp(action, "ping") == 0) {
    StaticJsonDocument<256> ack;
    ack["commandId"] = commandId;
    ack["deviceId"] = DEVICE_ID;
    ack["status"] = "SUCCESS";
    ack["message"] = "Pong từ ESP32-S3";
    ack["timestamp"] = getIsoTimestamp();

    char ackBuffer[256];
    serializeJson(ack, ackBuffer);
    String ackTopic = String("weather/") + DEVICE_ID + "/command/ack";
    mqttClient.publish(ackTopic.c_str(), ackBuffer, false);
  }
}

// --------------------------------------------------------------------------
// 4. SETUP & KHỞI TẠO
// --------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n[RainSense] Khởi động vi điều khiển ESP32-S3...");

  // Tạo định danh boot session độc nhất từ địa chỉ MAC
  bootId = "boot-" + String((uint32_t)ESP.getEfuseMac(), HEX);

  // Khởi tạo I2C và cảm biến môi trường BME280
  Wire.begin(I2C_SDA, I2C_SCL);
  if (!bme.begin(0x76, &Wire) && !bme.begin(0x77, &Wire)) {
    Serial.println("[CẢNH BÁO] Không tìm thấy cảm biến BME280! Kiểm tra lại chân SDA (GPIO21) và SCL (GPIO22).");
  } else {
    Serial.println("[OK] Cảm biến BME280 sẵn sàng.");
  }

  // Khởi tạo chân ngắt gầu lật Hall A3144
  pinMode(RAIN_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(RAIN_PIN), onRainBucketTip, FALLING);
  Serial.println("[OK] Chân ngắt cảm biến mưa A3144 sẵn sàng trên GPIO 4.");

  // Kết nối Wi-Fi
  Serial.printf("[Wi-Fi] Đang kết nối tới %s...", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[Wi-Fi] Đã kết nối! IP: %s | RSSI: %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());

  // Đồng bộ thời gian thực qua máy chủ NTP (UTC+7 Việt Nam)
  configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");

  // Thiết lập bảo mật TLS
  secureClient.setInsecure(); // Chấp nhận TLS chứng chỉ máy chủ HiveMQ Cloud

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  mqttClient.setBufferSize(1024);
}

// --------------------------------------------------------------------------
// 5. VÒNG LẶP CHÍNH (LOOP)
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

// Kết nối và quản lý LWT (Last Will & Testament)
void reconnectMqtt() {
  while (!mqttClient.connected()) {
    Serial.print("[MQTT] Đang kết nối tới HiveMQ Cloud...");
    String clientId = String(DEVICE_ID) + "-" + String(random(0xffff), HEX);
    String lwtTopic = String("weather/") + DEVICE_ID + "/status";
    String lwtPayload = "{\"deviceId\":\"" + String(DEVICE_ID) + "\",\"status\":\"offline\"}";

    // Kết nối với Last Will để máy chủ tự động phát hiện khi thiết bị ngắt kết nối
    if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS, lwtTopic.c_str(), 1, true, lwtPayload.c_str())) {
      Serial.println(" Thành công!");

      // Phát bản tin Online
      String statusTopic = String("weather/") + DEVICE_ID + "/status";
      String statusPayload = "{\"deviceId\":\"" + String(DEVICE_ID) + "\",\"status\":\"online\",\"firmwareVersion\":\"" + String(FIRMWARE_VER) + "\"}";
      mqttClient.publish(statusTopic.c_str(), statusPayload.c_str(), true);

      // Đăng ký nhận lệnh từ máy chủ
      String cmdTopic = String("weather/") + DEVICE_ID + "/command";
      mqttClient.subscribe(cmdTopic.c_str(), 1);
      Serial.printf("[MQTT] Đã đăng ký lắng nghe lệnh tại: %s\n", cmdTopic.c_str());
    } else {
      Serial.printf(" Thất bại, rc=%d. Thử lại sau 5 giây...\n", mqttClient.state());
      delay(5000);
    }
  }
}

// Phát bản tin quan trắc (Telemetry)
void publishTelemetry() {
  sequenceNumber++;
  float temp = bme.readTemperature();
  float humid = bme.readHumidity();
  float press = bme.readPressure() / 100.0F; // Chuyển Pa sang hPa

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

  Serial.printf("[Telemetry #%u] %s | Nhiệt độ: %.1f°C | Độ ẩm: %.1f%% | Khí áp: %.1f hPa | Tổng xung mưa: %u\n",
                sequenceNumber, topic.c_str(), temp, humid, press, totalRainTips);
}
