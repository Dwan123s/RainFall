#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <Adafruit_BMP085.h>
#include <DHT.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiMulti.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <time.h>

// --- CẤU HÌNH DANH SÁCH NHIỀU MẠNG WI-FI (GIỮ NGUYÊN 100%) ---
struct WifiCredential {
  const char *ssid;
  const char *password;
};

const WifiCredential WIFI_NETWORKS[] = {
  {"FPT", "29082006"},         // Mạng FPT
  {"P104", "fptxinchao"},      // Mạng P104 
  {"Life's Good Big Tits", "11111111"},
};
const size_t NUM_WIFI_NETWORKS = sizeof(WIFI_NETWORKS) / sizeof(WIFI_NETWORKS[0]);

// --- CẤU HÌNH EMQX CLOUD (TLS PORT 8883) ---
const char MQTT_HOST[] = "i1c0bdef.ala.asia-southeast1.emqxsl.com";
const uint16_t MQTT_PORT = 8883;
const char MQTT_USERNAME[] = "ESP32_RAINFALL";
const char MQTT_PASSWORD[] = "123456789";
const char MQTT_DATA_TOPIC[] = "weather/station01/data";
const char MQTT_STATUS_TOPIC[] = "weather/station01/status";

// Chứng chỉ gốc CA của EMQX Cloud
const char MQTT_ROOT_CA[] = R"EOF(
-----BEGIN CERTIFICATE-----
MIIDjjCCAnagAwIBAgIQAzrx5qcRqaC7KGSxHQn65TANBgkqhkiG9w0BAQsFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBH
MjAeFw0xMzA4MDExMjAwMDBaFw0zODAxMTUxMjAwMDBaMGExCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j
b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IEcyMIIBIjANBgkqhkiG
9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuzfNNNx7a8myaJCtSnX/RrohCgiN9RlUyfuI
2/Ou8jqJkTx65qsGGmvPrC3oXgkkRLpimn7Wo6h+4FR1IAWsULecYxpsMNzaHxmx
1x7e/dfgy5SDN67sH0NO3Xss0r0upS/kqbitOtSZpLYl6ZtrAGCSYP9PIUkY92eQ
q2EGnI/yuum06ZIya7XzV+hdG82MHauVBJVJ8zUtluNJbd134/tJS7SsVQepj5Wz
tCO7TG1F8PapspUwtP1MVYwnSlcUfIKdzXOS0xZKBgyMUNGPHgm+F6HmIcr9g+UQ
vIOlCsRnKPZzFBQ9RnbDhxSJITRNrw9FDKZJobq7nMWxM4MphQIDAQABo0IwQDAP
BgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBhjAdBgNVHQ4EFgQUTiJUIBiV
5uNu5g/6+rkS7QYXjzkwDQYJKoZIhvcNAQELBQADggEBAGBnKJRvDkhj6zHd6mcY
1Yl9PMWLSn/pvtsrF9+wX3N3KjITOYFnQoQj8kVnNeyIv/iPsGEMNKSuIEyExtv4
NeF22d+mQrvHRAiGfzZ0JFrabA0UWTW98kndth/Jsw1HKj2ZL7tcu7XUIOGZX1NG
Fdtom/DzMNU+MeKNhJ7jitralj41E6Vf8PlwUHBHQRFXGU7Aj64GxJUTFy8bJZ91
8rGOmaFvE7FBcf6IKshPECBV1/MUReXgRPTqh5Uykw7+U0b6LJ3/iyK5S9kJRaTe
pLiaWN0bfVKfjllDiIGknibVb63dDcY3fe0Dkhvld1927jyNxF1WW6LZZm6zNTfl
MrY=
-----END CERTIFICATE-----
)EOF";

const uint32_t MQTT_PUBLISH_INTERVAL_MS = 10000;
const uint32_t MQTT_EVENT_MIN_INTERVAL_MS = 1000;
const uint32_t WIFI_RETRY_INTERVAL_MS = 10000;
const uint32_t MQTT_RETRY_MIN_MS = 5000;
const uint32_t MQTT_RETRY_MAX_MS = 60000;

// Queue lưu bản đo telemetry giữa loop() và FreeRTOS Task
struct TelemetrySnapshot {
  int tips;
  float temperature;
  float humidity;
  float pressure;
  bool dhtOk;
  bool bmpOk;
  uint32_t resetSequence;
  uint32_t uptimeMs;
};
QueueHandle_t telemetryQueue = nullptr;
uint32_t rainResetSequence = 0;

void startNetwork();
void captureTelemetry();
void networkTask(void *parameter);
bool publishTelemetry(PubSubClient &mqtt, const TelemetrySnapshot &sample, const char *clientId);

// --- CẤU HÌNH PHẦN CỨNG ---
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define OLED_I2C_ADDR 0x3C

// Chân I2C (dùng chung song song cho cả Màn hình OLED và Cảm biến BMP180)
#define I2C_SDA 8
#define I2C_SCL 9

// Chân cảm biến mưa & DHT11 & Nút Boot
#define HALL_PIN 10
#define DHT_PIN 4
#define DHT_TYPE DHT11
#define BOOT_BUTTON_PIN 0

Adafruit_SH1106G display = Adafruit_SH1106G(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
Adafruit_BMP085 bmp;
DHT dht(DHT_PIN, DHT_TYPE);

// --- BIẾN ĐO MƯA ---
const float RAINFALL_PER_TIP = 0.64;         // 0.64 mm nước / lần lật
volatile int tipCount = 0;
volatile unsigned long lastTipTime = 0;
const unsigned long DEBOUNCE_DELAY = 200;   // Khóa chống dội 200ms

int lastDisplayedTipCount = 0;

// Biến lưu thông số môi trường
float currentTemp = 0.0;
float currentHum = 0.0;
float currentPress = 0.0;
unsigned long lastSensorReadTime = 0;
bool dhtFound = false;
bool bmpFound = false;

// NGẮT PHẦN CỨNG: bắt sườn xuống khi gàu lật
void IRAM_ATTR onHallInterrupt() {
  unsigned long now = millis();
  if (now - lastTipTime > DEBOUNCE_DELAY) {
    tipCount++;
    lastTipTime = now;
  }
}

// Đọc tipCount an toàn (tắt ngắt tạm thời trong lúc đọc biến volatile)
int getTipCount() {
  noInterrupts();
  int v = tipCount;
  interrupts();
  return v;
}

// --- HÀM LƯU & ĐỌC FLASH NVS ĐỘC LẬP ---
void saveTipsToFlash(int tips) {
  Preferences p;
  if (p.begin("rain_station", false)) {
    p.putInt("tips", tips);
    p.end();
    Serial.printf("[FLASH] Da ghi vao Flash: %d lan lat\n", tips);
  }
}

int loadTipsFromFlash() {
  Preferences p;
  int saved = 0;
  if (p.begin("rain_station", false)) {
    saved = p.getInt("tips", 0);
    p.end();
    Serial.printf("[FLASH] Khoi phuc tu Flash: %d lan lat\n", saved);
  }
  return saved;
}

void readEnvSensors();
void updateOledDisplay(int tips);
void resetRain(const char* reason);
bool initBMP();

void setup() {
  Serial.begin(115200);
  Serial.setTxTimeoutMs(0); // CHỐNG TREO ESP32-S3 KHI KHÔNG KẾT NỐI SERIAL MONITOR

  // 1. Cấu hình chân ngắt gàu lật & nút Boot
  pinMode(HALL_PIN, INPUT_PULLUP);
  pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(HALL_PIN), onHallInterrupt, FALLING);

  // 2. Khởi tạo Bus I2C (SDA=GPIO8, SCL=GPIO9, 100kHz) với timeout 50ms chống treo bus
  Wire.begin(I2C_SDA, I2C_SCL, 100000);
  Wire.setTimeOut(50);
  delay(100);

  // 3. Khởi tạo màn hình OLED
  display.begin(OLED_I2C_ADDR, true);
  // Khóa lại cấu hình chân I2C đảm bảo chân luôn là GPIO 8 & 9
  Wire.begin(I2C_SDA, I2C_SCL, 100000);
  Wire.setTimeOut(50);

  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);
  display.setTextSize(1);
  display.setTextWrap(false);

  // 4. Khôi phục số lần lật từ bộ nhớ Flash
  tipCount = loadTipsFromFlash();
  lastDisplayedTipCount = tipCount;

  // 5. Khởi tạo DHT11 & BMP180
  dht.begin();
  initBMP();

  // Khóa lại bus I2C sau khi initBMP để OLED luôn hoạt động ổn định
  Wire.begin(I2C_SDA, I2C_SCL, 100000);
  Wire.setTimeOut(50);

  // Đọc thông số ban đầu và hiển thị lập tức lên màn hình OLED
  readEnvSensors();
  updateOledDisplay(tipCount);

  // 6. Khởi động luồng mạng FreeRTOS ngầm
  startNetwork();
}

void loop() {
  unsigned long currentTime = millis();

  // 1. CẬP NHẬT TỨC THÌ KHI GÀU VỪA LẬT & LƯU NGAY VÀO FLASH
  int tips = getTipCount();
  if (tips != lastDisplayedTipCount) {
    lastDisplayedTipCount = tips;
    saveTipsToFlash(tips);
    updateOledDisplay(tips);
    Serial.printf("[MUA] GAU LAT! So lan: %d | Luong: %.2f mm\n", tips, tips * RAINFALL_PER_TIP);
  }

  // 2. ĐỌC DHT11 & BMP180 ĐỊNH KỲ MỖI 2.5 GIÂY
  if (currentTime - lastSensorReadTime >= 2500) {
    lastSensorReadTime = currentTime;
    readEnvSensors();
    updateOledDisplay(getTipCount());
  }

  // 3. NÚT BOOT (GPIO 0): PHẢI NHẤN GIỮ 3 GIÂY MỚI RESET MƯA
  static unsigned long btnPressStartTime = 0;
  static bool isBtnPressed = false;

  if (currentTime > 6000) { 
    bool btn = digitalRead(BOOT_BUTTON_PIN);
    if (btn == LOW) {
      if (!isBtnPressed) {
        isBtnPressed = true;
        btnPressStartTime = currentTime;
      } else if (currentTime - btnPressStartTime >= 3000) {
        isBtnPressed = false;
        resetRain("NHAN GIU NUT BOOT 3S");
      }
    } else {
      isBtnPressed = false;
    }
  }

  captureTelemetry();
  delay(1);
}

bool initBMP() {
  Wire.begin(I2C_SDA, I2C_SCL, 100000);
  Wire.setTimeOut(50);
  if (bmp.begin()) {
    bmpFound = true;
    Serial.println("[BMP180] Tim thay va khoi tao thanh cong tai dia chi 0x77!");
    Wire.begin(I2C_SDA, I2C_SCL, 100000);
    return true;
  }
  bmpFound = false;
  Wire.begin(I2C_SDA, I2C_SCL, 100000);
  Serial.println("[BMP180] Chua tim thay BMP180!");
  return false;
}

void readEnvSensors() {
  // 1. Đọc DHT11 (Độ ẩm & Nhiệt độ dự phòng)
  float h = dht.readHumidity();
  float t_dht = dht.readTemperature();

  static int dhtFailCount = 0;
  if (!isnan(h) && h >= 0.0 && h <= 100.0) {
    currentHum = h;
    dhtFound = true;
    dhtFailCount = 0;
  } else {
    dhtFailCount++;
    // Chỉ báo lỗi nếu mất đọc liên tục quá 4 lần (>10 giây) để tránh chớp nháy màn hình
    if (dhtFailCount > 4) {
      dhtFound = false;
    }
  }

  // 2. Đọc BMP180 (Áp suất khí quyển & Nhiệt độ chính xác cao)
  if (!bmpFound) {
    initBMP();
  }

  if (bmpFound) {
    float p = bmp.readPressure() / 100.0F; // Pa -> hPa
    float t_bmp = bmp.readTemperature();
    if (!isnan(p) && p > 300.0 && p < 1200.0) {
      currentPress = p;
      if (!isnan(t_bmp) && t_bmp > -40.0 && t_bmp < 85.0) {
        currentTemp = t_bmp; // Ưu tiên nhiệt độ mượt mà từ BMP180
      }
    } else {
      bmpFound = false;
    }
  }

  // Dự phòng: Nếu mất BMP180 nhưng DHT11 vẫn đọc tốt, lấy nhiệt độ từ DHT11
  if (!bmpFound && dhtFound && !isnan(t_dht) && t_dht > -40.0 && t_dht < 85.0) {
    currentTemp = t_dht;
  }
}

void resetRain(const char* reason) {
  noInterrupts();
  tipCount = 0;
  interrupts();
  lastDisplayedTipCount = 0;
  rainResetSequence++;

  saveTipsToFlash(0);

  Serial.printf("\n==================================================\n");
  Serial.printf(">>> DA RESET LUONG MUA VE 0 | LY DO: %s <<<\n", reason);
  Serial.printf("==================================================\n\n");
  updateOledDisplay(0);
}

// Bố cục hiển thị OLED 128x64
void updateOledDisplay(int tips) {
  float rainMm = tips * RAINFALL_PER_TIP;

  display.clearDisplay();
  // ĐẢM BẢO CHỮ LUÔN MÀU TRẮNG VÀ CỠ 1 ĐỂ KHÔNG BỊ MẤT CHỮ TRÊN MÀN HÌNH ĐEN
  display.setTextColor(SH110X_WHITE);
  display.setTextSize(1);
  display.setTextWrap(false);

  display.drawRect(0, 0, 128, 64, SH110X_WHITE);

  // Tiêu đề
  display.setCursor(10, 4);
  display.print("TRAM DO LUONG MUA");
  display.drawLine(0, 14, 128, 14, SH110X_WHITE);

  // Nhiệt độ & Độ ẩm
  display.setCursor(5, 18);
  if (bmpFound || dhtFound) {
    display.printf("T:%.1fC", currentTemp);
  } else {
    display.print("T:--.-C");
  }

  display.setCursor(68, 18);
  if (dhtFound) {
    display.printf("H:%.1f%%", currentHum);
  } else {
    display.print("H:--.-%");
  }

  // Áp suất khí quyển
  display.setCursor(5, 30);
  if (bmpFound) {
    display.printf("P: %.1f hPa", currentPress);
  } else {
    display.print("P: Mat BMP180!");
  }

  display.drawLine(0, 42, 128, 42, SH110X_WHITE);

  // Lượng mưa và số lần lật
  display.setCursor(5, 48);
  display.printf("Mua:%.1fmm", rainMm);
  display.setCursor(82, 48);
  display.printf("%d lan", tips);

  display.display();
}

// ===================== PHẦN WI-FI MULTI / MQTT (FREERTOS TASK) =====================

void startNetwork() {
  if (NUM_WIFI_NETWORKS == 0 || WIFI_NETWORKS[0].ssid[0] == '\0') {
    Serial.println("[NET] Chua cau hinh Wi-Fi. Tram tiep tuc chay offline.");
    return;
  }
  telemetryQueue = xQueueCreate(1, sizeof(TelemetrySnapshot));
  if (telemetryQueue == nullptr) return;

  captureTelemetry();
  // Khởi chạy task ngầm xử lý mạng trên FreeRTOS
  xTaskCreate(networkTask, "wifi_mqtt", 12288, nullptr, 1, nullptr);
}

void captureTelemetry() {
  if (telemetryQueue == nullptr) return;
  static bool firstSample = true;
  static uint32_t lastCapture = 0;
  const uint32_t now = millis();
  if (!firstSample && uint32_t(now - lastCapture) < 100) return;
  firstSample = false;
  lastCapture = now;

  TelemetrySnapshot sample;
  sample.tips = getTipCount();
  sample.temperature = currentTemp;
  sample.humidity = currentHum;
  sample.pressure = currentPress;
  sample.dhtOk = dhtFound;
  sample.bmpOk = bmpFound;
  sample.resetSequence = rainResetSequence;
  sample.uptimeMs = now;
  xQueueOverwrite(telemetryQueue, &sample);
}

bool publishTelemetry(PubSubClient &mqtt, const TelemetrySnapshot &sample, const char *clientId) {
  char tempStr[16], humStr[16], pressStr[16];

  if (sample.bmpOk || sample.dhtOk) snprintf(tempStr, sizeof(tempStr), "%.2f", sample.temperature);
  else snprintf(tempStr, sizeof(tempStr), "null");

  if (sample.dhtOk) snprintf(humStr, sizeof(humStr), "%.2f", sample.humidity);
  else snprintf(humStr, sizeof(humStr), "null");

  if (sample.bmpOk) snprintf(pressStr, sizeof(pressStr), "%.2f", sample.pressure);
  else snprintf(pressStr, sizeof(pressStr), "null");

  char payload[512];
  const int length = snprintf(
      payload, sizeof(payload),
      "{\"device_id\":\"%s\",\"temperature_c\":%s,\"humidity_pct\":%s,"
      "\"pressure_hpa\":%s,\"rain_mm\":%.2f,\"tip_count\":%d,"
      "\"bme280_found\":%s,\"rain_reset_sequence\":%lu,"
      "\"uptime_ms\":%lu,\"published_at_unix\":%llu,\"wifi_rssi_dbm\":%d}",
      clientId, tempStr, humStr, pressStr,
      static_cast<double>(sample.tips * RAINFALL_PER_TIP), sample.tips,
      (sample.bmpOk || sample.dhtOk) ? "true" : "false",
      static_cast<unsigned long>(sample.resetSequence),
      static_cast<unsigned long>(sample.uptimeMs),
      static_cast<unsigned long long>(time(nullptr)), WiFi.RSSI());

  if (length < 0 || static_cast<size_t>(length) >= sizeof(payload)) return false;

  const bool sent = mqtt.publish(MQTT_DATA_TOPIC, payload, true);
  if (sent) Serial.printf("[MQTT] Da gui: %s\n", payload);
  else Serial.println("[MQTT] Gui that bai, se thu lai.");
  return sent;
}

void networkTask(void *parameter) {
  (void)parameter;
  WiFiClientSecure tlsClient;
  PubSubClient mqtt(tlsClient);
  tlsClient.setCACert(MQTT_ROOT_CA);
  tlsClient.setHandshakeTimeout(8);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setKeepAlive(30);
  mqtt.setSocketTimeout(3);

  if (!mqtt.setBufferSize(1024)) {
    vTaskDelete(nullptr);
    return;
  }

  // Cấu hình Wi-Fi Multi tự động chuyển sang mạng có sóng tốt nhất
  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);

  WiFiMulti wifiMulti;
  for (size_t i = 0; i < NUM_WIFI_NETWORKS; i++) {
    if (WIFI_NETWORKS[i].ssid && WIFI_NETWORKS[i].ssid[0] != '\0') {
      wifiMulti.addAP(WIFI_NETWORKS[i].ssid, WIFI_NETWORKS[i].password);
      Serial.printf("[WiFi] Da dang ky mang WiFi: %s\n", WIFI_NETWORKS[i].ssid);
    }
  }

  Serial.println("[WiFi] Dang quet va ket noi vao mang WiFi manh nhat...");
  wifiMulti.run();

  const uint64_t chipId = ESP.getEfuseMac();
  char clientId[40];
  snprintf(clientId, sizeof(clientId), "weather-%04X%08lX",
           static_cast<unsigned int>((chipId >> 32) & 0xFFFF),
           static_cast<unsigned long>(chipId & 0xFFFFFFFFULL));

  bool wifiWasConnected = false;
  bool timeSyncStarted = false;
  bool forcePublish = true;
  bool havePublished = false;
  int lastSentTips = 0;
  uint32_t lastSentReset = 0;
  uint32_t lastWifiAttempt = millis();
  uint32_t lastMqttAttempt = millis() - MQTT_RETRY_MIN_MS;
  uint32_t mqttRetryMs = MQTT_RETRY_MIN_MS;
  uint32_t lastPublish = 0;
  uint32_t lastPublishAttempt = millis() - MQTT_EVENT_MIN_INTERVAL_MS;
  TelemetrySnapshot sample = {};

  for (;;) {
    uint32_t now = millis();

    // 1. Kiểm tra kết nối WiFi
    if (WiFi.status() != WL_CONNECTED) {
      if (wifiWasConnected) {
        Serial.println("[WiFi] Mat ket noi, dang quet mang du phong khac...");
        tlsClient.stop();
        wifiWasConnected = false;
        forcePublish = true;
      }
      if (uint32_t(now - lastWifiAttempt) >= WIFI_RETRY_INTERVAL_MS) {
        lastWifiAttempt = millis();
        wifiMulti.run();
      }
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }

    if (!wifiWasConnected) {
      wifiWasConnected = true;
      Serial.printf("[WiFi] Da ket noi! SSID: %s | IP: %s\n",
                    WiFi.SSID().c_str(), WiFi.localIP().toString().c_str());
      mqttRetryMs = MQTT_RETRY_MIN_MS;
      lastMqttAttempt = now - mqttRetryMs;
      if (!timeSyncStarted) {
        configTime(0, 0, "pool.ntp.org", "time.cloudflare.com", "time.google.com");
        timeSyncStarted = true;
      }
    }

    // 2. Chờ đồng bộ thời gian NTP (cần cho chứng thực TLS)
    if (time(nullptr) < 1704067200LL) {
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }

    // 3. Kết nối và duy trì MQTT Broker
    if (!mqtt.connected()) {
      if (uint32_t(now - lastMqttAttempt) >= mqttRetryMs) {
        tlsClient.stop();
        Serial.printf("[MQTT] Ket noi TLS %s:%u...\n", MQTT_HOST, MQTT_PORT);
        const bool connected = mqtt.connect(clientId, MQTT_USERNAME, MQTT_PASSWORD,
                                             MQTT_STATUS_TOPIC, 1, true, "offline");
        lastMqttAttempt = millis();
        if (connected) {
          mqttRetryMs = MQTT_RETRY_MIN_MS;
          forcePublish = true;
          lastPublishAttempt = millis() - MQTT_EVENT_MIN_INTERVAL_MS;
          mqtt.publish(MQTT_STATUS_TOPIC, "online", true);
          Serial.println("[MQTT] Da ket noi TLS thanh cong!");
        } else {
          tlsClient.stop();
          mqttRetryMs = mqttRetryMs < MQTT_RETRY_MAX_MS / 2 ? mqttRetryMs * 2 : MQTT_RETRY_MAX_MS;
        }
      }
      vTaskDelay(pdMS_TO_TICKS(50));
      continue;
    }

    mqtt.loop();

    // 4. Lấy dữ liệu mới nhất từ Queue và gửi lên MQTT
    if (xQueuePeek(telemetryQueue, &sample, 0) == pdTRUE) {
      now = millis();
      const bool rainChanged = !havePublished || sample.tips != lastSentTips ||
                               sample.resetSequence != lastSentReset;
      const bool periodic = uint32_t(now - lastPublish) >= MQTT_PUBLISH_INTERVAL_MS;
      if ((forcePublish || rainChanged || periodic) &&
          uint32_t(now - lastPublishAttempt) >= MQTT_EVENT_MIN_INTERVAL_MS) {
        lastPublishAttempt = now;
        if (publishTelemetry(mqtt, sample, clientId)) {
          lastPublish = millis();
          lastSentTips = sample.tips;
          lastSentReset = sample.resetSequence;
          havePublished = true;
          forcePublish = false;
        }
      }
    }
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}
