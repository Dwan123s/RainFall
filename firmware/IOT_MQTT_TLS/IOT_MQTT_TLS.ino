#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <Adafruit_BME280.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiMulti.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <time.h>
#include <math.h>
#include <string.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>

// --- CẤU HÌNH DANH SÁCH NHIỀU MẠNG WI-FI ---
// ESP32-S3 sẽ tự động quét và kết nối vào mạng có sóng mạnh nhất và khả dụng nhất.
// Nếu mạng này mất, mạch tự động chuyển sang mạng tiếp theo trong danh sách mà không cần reset.
struct WifiCredential {
  const char *ssid;
  const char *password;
};

const WifiCredential WIFI_NETWORKS[] = {
  {"FPT", "29082006"},         // Mạng FPT
  {"P104", "fptxinchao"},      // Mạng P104 
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

// Queue lưu bản đo mới nhất
struct TelemetrySnapshot {
  int tips;
  float temperature;
  float humidity;
  float pressure;
  bool bmePresent;
  uint32_t resetSequence;
  uint32_t uptimeMs;
};
QueueHandle_t telemetryQueue = nullptr;
uint32_t rainResetSequence = 0;

void startNetwork();
void captureTelemetry();
void networkTask(void *parameter);
bool networkConfigReady();
void jsonNumber(float value, char *buffer, size_t capacity);
bool publishTelemetry(PubSubClient &mqtt, const TelemetrySnapshot &sample,
                      const char *clientId);

// --- CẤU HÌNH PHẦN CỨNG ---
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define OLED_I2C_ADDR 0x3C

#define I2C_SDA 8
#define I2C_SCL 9
#define HALL_PIN 10
#define BOOT_BUTTON_PIN 0

Preferences prefs;
Adafruit_SH1106G display = Adafruit_SH1106G(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
// --- LỚP MỞ RỘNG BME280: MỞ KHÓA THANH GHI ĐỘ ẨM THÔ KHÔNG BỊ GIỚI HẠN CẮT NGỌN ---
class CalibratedBME280 : public Adafruit_BME280 {
public:
  float readUnclampedHumidity() {
    readTemperature(); // Cập nhật biến t_fine chuẩn xác theo công thức bù nhiệt của Bosch

    int32_t adc_H = read16(BME280_REGISTER_HUMIDDATA);
    if (adc_H == 0x8000) return NAN;

    int32_t v_x1_u32r;
    v_x1_u32r = (t_fine - ((int32_t)76800));

    v_x1_u32r = (((((adc_H << 14) - (((int32_t)_bme280_calib.dig_H4) << 20) -
                    (((int32_t)_bme280_calib.dig_H5) * v_x1_u32r)) +
                   ((int32_t)16384)) >> 15) *
                 (((((((v_x1_u32r * ((int32_t)_bme280_calib.dig_H6)) >> 10) *
                      (((v_x1_u32r * ((int32_t)_bme280_calib.dig_H3)) >> 11) +
                       ((int32_t)32768))) >> 10) +
                    ((int32_t)2097152)) *
                       ((int32_t)_bme280_calib.dig_H2) +
                   8192) >> 14));

    v_x1_u32r = (v_x1_u32r - (((((v_x1_u32r >> 15) * (v_x1_u32r >> 15)) >> 7) *
                               ((int32_t)_bme280_calib.dig_H1)) >> 4));

    if (v_x1_u32r < 0) v_x1_u32r = 0;
    // BỎ QUA lệnh cắt ngọn 100% của thư viện gốc:
    // Thư viện gốc có: if (v_x1_u32r > 419430400) v_x1_u32r = 419430400; và if (h > 100.0) h = 100.0;
    // Bằng cách đọc trực tiếp giá trị thực (có thể là 130% do lệch ẩm), ta thu được toàn bộ dải biến thiên liên tục!
    return (float)(v_x1_u32r >> 12) / 1024.0;
  }
};

CalibratedBME280 bme;

// --- BIẾN ĐO MƯA ---
const float RAINFALL_PER_TIP = 0.64;          // 0.64 mm nước / lần lật
volatile int tipCount = 0;
volatile unsigned long lastTipTime = 0;
const unsigned long DEBOUNCE_DELAY = 200;    // Khóa chống dội 200ms

int lastDisplayedTipCount = 0;

// Biến lưu thông số môi trường
float currentTemp = 0.0;
float currentHum = 0.0;
float currentPress = 0.0;
unsigned long lastBmeReadTime = 0;
bool bmeFound = false;

// --- CẤU HÌNH CO GIÃN ĐỘ ẨM ĐỘNG (DYNAMIC HUMIDITY SCALING) ---
// Không dùng phép trừ phẳng (vì trừ phẳng sẽ bị kẹt thành đường thẳng nằm ngang 76%).
// Sử dụng hệ số tỷ lệ co giãn động: Độ ẩm thực tế = Độ ẩm thô * HUMIDITY_SCALE_FACTOR
// - Khi độ ẩm phòng bình thường (~76%): đo ra ~76%
// - Khi trời nồm ẩm, mưa (~90% - 95%): giá trị tự động TĂNG MƯỢT MÀ lên 90% - 95%, KHÔNG BỊ CHẶN Ở 76%!
// - Khi trời nắng ráo (~55% - 65%): giá trị tự động GIẢM MƯỢT MÀ xuống 55% - 65%!
float HUMIDITY_SCALE_FACTOR = 0.71; // Tỷ lệ mặc định đưa về 67% (Được lưu vĩnh viễn vào Flash khi chỉnh bằng + / -)

// Biến cho nút BOOT (Reset)
bool lastButtonState = HIGH;
unsigned long lastButtonChange = 0;

// NGẮT PHẦN CỨNG: bắt sườn xuống khi gàu lật
void IRAM_ATTR onHallInterrupt() {
  unsigned long now = millis();
  if (now - lastTipTime > DEBOUNCE_DELAY) {
    tipCount++;
    lastTipTime = now;
  }
}

// Đọc tipCount an toàn (tắt ngắt trong lúc đọc)
int getTipCount() {
  noInterrupts();
  int v = tipCount;
  interrupts();
  return v;
}

void readEnvSensors();
void updateOledDisplay(int tips);
void resetRain();
bool initBME();
void diagnoseBME();

void setup() {
  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);

  // Đọc hệ số hiệu chuẩn đã lưu trong bộ nhớ Flash vĩnh viễn (NVS)
  prefs.begin("weather_calib", false);
  HUMIDITY_SCALE_FACTOR = prefs.getFloat("h_scale", 0.71);

  unsigned long startWait = millis();
  while (!Serial && (millis() - startWait < 2000)) {
    delay(10);
  }

  // Khởi tạo I2C với tốc độ 100kHz (chuẩn an toàn, chống nhiễu cho BME280 trên dây cắm)
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(100000);
  delay(100);

  pinMode(HALL_PIN, INPUT_PULLUP);
  pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);

  attachInterrupt(digitalPinToInterrupt(HALL_PIN), onHallInterrupt, FALLING);

  // 1. Khởi tạo OLED SH1106
  if (!display.begin(OLED_I2C_ADDR, true)) {
    Serial.println("[LOI] Khong tim thay OLED SH1106!");
  } else {
    display.clearDisplay();
    display.setTextColor(SH110X_WHITE);
    display.setTextWrap(false);
    display.setTextSize(1);
    display.drawRect(0, 0, 128, 64, SH110X_WHITE);
    display.setCursor(16, 25);
    display.print("HE THONG SAN SANG");
    display.display();
    delay(600);
  }

  // 2. Khởi tạo BME280 với kiểm tra tự động cả 2 địa chỉ 0x76 và 0x77
  delay(50);
  diagnoseBME();
  if (initBME()) {
    readEnvSensors();
  }

  updateOledDisplay(getTipCount());
  startNetwork();
}

void loop() {
  unsigned long currentTime = millis();

  // 1. CẬP NHẬT TỨC THÌ KHI GÀU VỪA LẬT
  int tips = getTipCount();
  if (tips != lastDisplayedTipCount) {
    lastDisplayedTipCount = tips;
    updateOledDisplay(tips);
    Serial.printf("[MUA] GAU LAT! So lan: %d | Luong: %.2f mm\n", tips, tips * RAINFALL_PER_TIP);
  }

  // 2. ĐỌC BME280 MỖI 2.5 GIÂY
  if (currentTime - lastBmeReadTime >= 2500) {
    lastBmeReadTime = currentTime;
    readEnvSensors();
    updateOledDisplay(getTipCount());
  }

  // 3. NÚT BOOT: nhấn để reset lượng mưa về 0
  bool btn = digitalRead(BOOT_BUTTON_PIN);
  if (btn != lastButtonState && (currentTime - lastButtonChange) > 40) {
    lastButtonChange = currentTime;
    lastButtonState = btn;
    if (btn == LOW) {
      resetRain();
    }
  }

  // Phím 'r' từ máy tính
  if (Serial.available() > 0) {
    char c = Serial.read();
    if (c == 'r' || c == 'R') {
      resetRain();
    }
    if (c == 'b' || c == 'B') {
      Serial.println("\n>>> DANG CHAN DOAN VA KHOI TAO LAI BME280... <<<");
      diagnoseBME();
      initBME();
    }
    if (c == '+' || c == '=') {
      HUMIDITY_SCALE_FACTOR += 0.01;
      prefs.putFloat("h_scale", HUMIDITY_SCALE_FACTOR); // LƯU VĨNH VIỄN VÀO FLASH (TẮT BẬT LẠI KHÔNG BỊ MẤT)
      readEnvSensors();
      updateOledDisplay(getTipCount());
      Serial.printf("[CALIB] Tang ty le (DA LUU VAO FLASH): HUMIDITY_SCALE_FACTOR = %.2f | Do am OLED: %.1f%%\n", HUMIDITY_SCALE_FACTOR, currentHum);
    }
    if (c == '-' || c == '_') {
      HUMIDITY_SCALE_FACTOR -= 0.01;
      prefs.putFloat("h_scale", HUMIDITY_SCALE_FACTOR); // LƯU VĨNH VIỄN VÀO FLASH (TẮT BẬT LẠI KHÔNG BỊ MẤT)
      readEnvSensors();
      updateOledDisplay(getTipCount());
      Serial.printf("[CALIB] Giam ty le (DA LUU VAO FLASH): HUMIDITY_SCALE_FACTOR = %.2f | Do am OLED: %.1f%%\n", HUMIDITY_SCALE_FACTOR, currentHum);
    }
  }

  captureTelemetry();
  delay(1);
}

bool initBME() {
  // Thử lần lượt địa chỉ 0x76 và 0x77
  uint8_t addrs[] = {0x76, 0x77};
  for (int i = 0; i < 2; i++) {
    if (bme.begin(addrs[i], &Wire)) {
      bmeFound = true;
      // BẮT BUỘC gọi setSampling: Kích hoạt thanh ghi ctrl_hum (0xF2)
      // Nếu không cấu hình, thanh ghi độ ẩm mặc định ở 0x00 (Skipped) khiến readHumidity bị khóa ở 100%
      bme.setSampling(Adafruit_BME280::MODE_NORMAL,
                      Adafruit_BME280::SAMPLING_X2,  // Nhiệt độ: oversampling x2
                      Adafruit_BME280::SAMPLING_X16, // Khí áp: oversampling x16
                      Adafruit_BME280::SAMPLING_X1,  // Độ ẩm: BẬT oversampling x1
                      Adafruit_BME280::FILTER_X16,
                      Adafruit_BME280::STANDBY_MS_0_5);
      Serial.printf("[BME280] Khoi tao va kich hoat do am thanh cong tai 0x%02X!", addrs[i]);
      return true;
    }
  }
  bmeFound = false;
  return false;
}

void diagnoseBME() {
  Serial.println("\n--- [CHAN DOAN I2C & BME280] ---");
  byte addresses[] = {0x76, 0x77};
  bool foundAny = false;
  for (byte i = 0; i < 2; i++) {
    byte addr = addresses[i];
    Wire.beginTransmission(addr);
    byte err = Wire.endTransmission();
    if (err == 0) {
      foundAny = true;
      Serial.printf("[I2C] Phat hien thiet bi tai dia chi 0x%02X!\n", addr);
      // 1. Đọc thanh ghi Chip ID (0xD0)
      Wire.beginTransmission(addr);
      Wire.write(0xD0);
      if (Wire.endTransmission() == 0) {
        Wire.requestFrom((int)addr, 1);
        if (Wire.available()) {
          byte chipId = Wire.read();
          Serial.printf("      Chip ID: 0x%02X", chipId);
          if (chipId == 0x60) {
            Serial.println(" (Chuan chip BME280 co Do Am)");
          } else if (chipId == 0x58 || chipId == 0x56 || chipId == 0x57) {
            Serial.println(" (CHU Y: Day la chip BMP280, KHONG CO CAM BIEN DO AM)");
          } else {
            Serial.printf(" (Chip ID: 0x%02X khac 0x60)\n", chipId);
          }
        }
      }
      // 2. Đọc thanh ghi ctrl_hum (0xF2)
      Wire.beginTransmission(addr);
      Wire.write(0xF2);
      if (Wire.endTransmission() == 0) {
        Wire.requestFrom((int)addr, 1);
        if (Wire.available()) {
          byte ctrlHum = Wire.read();
          Serial.printf("      ctrl_hum (0xF2): 0x%02X (%s)\n", ctrlHum, ctrlHum == 0 ? "0x00=Skipped/Chua bat" : "Dang bat");
        }
      }
      // 3. Đọc dữ liệu độ ẩm thô (0xFD, 0xFE)
      Wire.beginTransmission(addr);
      Wire.write(0xFD);
      if (Wire.endTransmission() == 0) {
        Wire.requestFrom((int)addr, 2);
        if (Wire.available() >= 2) {
          byte hMsb = Wire.read();
          byte hLsb = Wire.read();
          uint16_t rawHum = (hMsb << 8) | hLsb;
          Serial.printf("      Raw Humidity ADC (0xFD-0xFE): 0x%04X (%u)\n", rawHum, rawHum);
          if (rawHum == 0x8000) {
            Serial.println("      => [!] 0x8000: Do am chua duoc kich hoat tren chip.");
          } else if (rawHum == 0xFFFF) {
            Serial.println("      => [!] 0xFFFF: Cam bien bi bao hoa kich tran (Do nuoc dong trong lo kim loai hoac loi phan cung).");
          }
        }
      }
    }
  }
  if (!foundAny) {
    Serial.println("[!] KHONG PHAT HIEN THIET BI NAO o dia chi 0x76 hoac 0x77!");
    Serial.println("    Vui long kiem tra 4 day noi cua cam bien BME280:");
    Serial.println("    - VCC -> Chan 3V3 (ESP32-S3)");
    Serial.println("    - GND -> Chan GND");
    Serial.println("    - SCL -> Chan GPIO 9");
    Serial.println("    - SDA -> Chan GPIO 8");
  }
  Serial.println("--------------------------------\n");
}

void readEnvSensors() {
  // Nếu chưa tìm thấy cảm biến, tự động thử kết nối lại
  if (!bmeFound) {
    initBME();
  }

  if (bmeFound) {
    float t = bme.readTemperature();
    float rawH = bme.readHumidity();
    float p = bme.readPressure() / 100.0F;

    // Kiểm tra tính hợp lệ của dữ liệu
    if (!isnan(t) && !isnan(rawH) && !isnan(p) && t > -40.0 && t < 85.0 && p > 300.0) {
      currentTemp = t;
      currentPress = p;

      // Đo độ ẩm thô mở khóa toàn dải (Unclamped)
      float unclampedH = bme.readUnclampedHumidity();
      if (isnan(unclampedH)) unclampedH = rawH;

      // Áp dụng co giãn động toàn dải: giữ trọn vẹn độ nhạy biến thiên thực tế
      float dynamicH = unclampedH * HUMIDITY_SCALE_FACTOR;
      if (dynamicH > 99.0) dynamicH = 99.0;
      if (dynamicH < 15.0) dynamicH = 15.0;
      currentHum = dynamicH;
      Serial.printf("[BME280] Nhiet do: %.1fC | Khi ap: %.1f hPa | Do am thuc te: %.1f%% (Goc chua cat: %.1f%%)\n", currentTemp, currentPress, currentHum, unclampedH);
    } else {
      Serial.println("[BME280] Du lieu loi hoac mat tiep xuc day, danh dau thu lai...");
      bmeFound = false;
    }
  }
}

void resetRain() {
  noInterrupts();
  tipCount = 0;
  interrupts();
  lastDisplayedTipCount = 0;
  rainResetSequence++;
  Serial.println("\n>>> DA RESET LUONG MUA VE 0 <<<\n");
  updateOledDisplay(0);
}

void updateOledDisplay(int tips) {
  float rainMm = tips * RAINFALL_PER_TIP;

  display.clearDisplay();
  display.drawRect(0, 0, 128, 64, SH110X_WHITE);

  // Tiêu đề
  display.setCursor(10, 4);
  display.print("TRAM DO LUONG MUA");
  display.drawLine(0, 14, 128, 14, SH110X_WHITE);

  // Nhiệt độ & Độ ẩm
  display.setCursor(5, 18);
  if (bmeFound) {
    display.printf("T:%.1fC", currentTemp);
    display.setCursor(68, 18);
    display.printf("H:%.1f%%", currentHum);
  } else {
    display.print("T:--.-C");
    display.setCursor(68, 18);
    display.print("H:--.-%");
  }

  // Áp suất
  display.setCursor(5, 30);
  if (bmeFound) {
    display.printf("P: %.1f hPa", currentPress);
  } else {
    display.print("P: Mat BME280!");
  }

  display.drawLine(0, 42, 128, 42, SH110X_WHITE);

  // Lượng mưa (trái) và số lần lật (phải)
  display.setCursor(5, 48);
  display.printf("Mua:%.1fmm", rainMm);
  display.setCursor(82, 48);
  display.printf("%d lan", tips);

  display.display();
}

// ===================== PHẦN WI-FI MULTI / MQTT BỔ SUNG =====================

bool networkConfigReady() {
  bool hasValidWifi = false;
  for (size_t i = 0; i < NUM_WIFI_NETWORKS; i++) {
    if (WIFI_NETWORKS[i].ssid && WIFI_NETWORKS[i].ssid[0] != '\0' &&
        strcmp(WIFI_NETWORKS[i].ssid, "YOUR_WIFI_SSID") != 0) {
      hasValidWifi = true;
      break;
    }
  }

  return hasValidWifi &&
         MQTT_HOST[0] != '\0' && strstr(MQTT_HOST, "YOUR_") == nullptr &&
         MQTT_USERNAME[0] != '\0' &&
         strcmp(MQTT_USERNAME, "YOUR_MQTT_USERNAME") != 0 &&
         MQTT_PASSWORD[0] != '\0' &&
         strcmp(MQTT_PASSWORD, "YOUR_MQTT_PASSWORD") != 0 &&
         MQTT_DATA_TOPIC[0] != '\0' && MQTT_STATUS_TOPIC[0] != '\0' &&
         strlen(MQTT_DATA_TOPIC) <= 120 && strlen(MQTT_STATUS_TOPIC) <= 120 &&
         strstr(MQTT_ROOT_CA, "PASTE_") == nullptr &&
         strstr(MQTT_ROOT_CA, "-----BEGIN CERTIFICATE-----") != nullptr &&
         strstr(MQTT_ROOT_CA, "-----END CERTIFICATE-----") != nullptr;
}

void startNetwork() {
  if (!networkConfigReady()) {
    Serial.println("[NET] Chua dien du Wi-Fi / MQTT / CA. Tram van do va hien thi binh thuong.");
    return;
  }
  telemetryQueue = xQueueCreate(1, sizeof(TelemetrySnapshot));
  if (telemetryQueue == nullptr) {
    Serial.println("[NET] Khong du RAM tao queue. Tram tiep tuc chay offline.");
    return;
  }
  captureTelemetry();
  if (xTaskCreate(networkTask, "wifi_mqtt", 12288, nullptr, 1, nullptr) != pdPASS) {
    vQueueDelete(telemetryQueue);
    telemetryQueue = nullptr;
    Serial.println("[NET] Khong tao duoc task. Tram tiep tuc chay offline.");
  }
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
  sample.bmePresent = bmeFound;
  sample.resetSequence = rainResetSequence;
  sample.uptimeMs = now;
  xQueueOverwrite(telemetryQueue, &sample);
}

void jsonNumber(float value, char *buffer, size_t capacity) {
  if (isfinite(value)) {
    snprintf(buffer, capacity, "%.2f", static_cast<double>(value));
  } else {
    snprintf(buffer, capacity, "null");
  }
}

bool publishTelemetry(PubSubClient &mqtt, const TelemetrySnapshot &sample,
                      const char *clientId) {
  char temperature[48], humidity[48], pressure[48];
  jsonNumber(sample.bmePresent ? sample.temperature : NAN, temperature, sizeof(temperature));
  jsonNumber(sample.bmePresent ? sample.humidity : NAN, humidity, sizeof(humidity));
  jsonNumber(sample.bmePresent ? sample.pressure : NAN, pressure, sizeof(pressure));
  char payload[640];
  const int length = snprintf(
      payload, sizeof(payload),
      "{\"device_id\":\"%s\",\"temperature_c\":%s,\"humidity_pct\":%s,"
      "\"pressure_hpa\":%s,\"rain_mm\":%.2f,\"tip_count\":%d,"
      "\"bme280_found\":%s,\"rain_reset_sequence\":%lu,"
      "\"uptime_ms\":%lu,\"published_at_unix\":%llu,\"wifi_rssi_dbm\":%d}",
      clientId, temperature, humidity, pressure,
      static_cast<double>(sample.tips * RAINFALL_PER_TIP), sample.tips,
      sample.bmePresent ? "true" : "false",
      static_cast<unsigned long>(sample.resetSequence),
      static_cast<unsigned long>(sample.uptimeMs),
      static_cast<unsigned long long>(time(nullptr)), WiFi.RSSI());
  if (length < 0 || static_cast<size_t>(length) >= sizeof(payload)) {
    Serial.println("[MQTT] JSON qua dai, khong gui ban tin bi cat.");
    return false;
  }
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
    Serial.println("[MQTT] Khong du RAM tao buffer. Tram van chay offline.");
    vTaskDelete(nullptr);
    return;
  }

  // Khởi tạo WiFiMulti quản lý nhiều mạng WiFi
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
  uint32_t lastTimeNotice = millis() - 30000UL;
  TelemetrySnapshot sample = {};

  for (;;) {
    uint32_t now = millis();

    // Kiểm tra kết nối WiFi bằng WiFiMulti
    if (WiFi.status() != WL_CONNECTED) {
      if (wifiWasConnected) {
        Serial.println("[WiFi] Mat ket noi, dang quet mang du phong khac...");
        tlsClient.stop();
        wifiWasConnected = false;
        forcePublish = true;
      }
      if (uint32_t(now - lastWifiAttempt) >= WIFI_RETRY_INTERVAL_MS) {
        lastWifiAttempt = millis();
        Serial.println("[WiFi] Dang thu ket noi vao mang WiFi tot nhat...");
        wifiMulti.run();
      }
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }

    if (!wifiWasConnected) {
      wifiWasConnected = true;
      Serial.printf("[WiFi] Da ket noi thanh cong! SSID: %s | IP: %s | RSSI: %d dBm\n",
                    WiFi.SSID().c_str(), WiFi.localIP().toString().c_str(), WiFi.RSSI());
      mqttRetryMs = MQTT_RETRY_MIN_MS;
      lastMqttAttempt = now - mqttRetryMs;
      if (!timeSyncStarted) {
        configTime(0, 0, "pool.ntp.org", "time.cloudflare.com", "time.google.com");
        timeSyncStarted = true;
      }
    }

    // Chờ NTP sync giờ
    if (time(nullptr) < 1704067200LL) {
      if (uint32_t(now - lastTimeNotice) >= 30000UL) {
        lastTimeNotice = now;
        Serial.println("[TLS] Dang doi NTP. Kiem tra Internet / UDP 123 neu cho lau.");
      }
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }

    // Kết nối MQTT Broker
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
          if (mqtt.publish(MQTT_STATUS_TOPIC, "online", true)) {
            Serial.println("[MQTT] Da ket noi.");
          } else {
            Serial.println("[MQTT] Khong gui duoc trang thai online, se ket noi lai.");
            tlsClient.stop();
          }
        } else {
          Serial.printf("[MQTT] Loi state=%d. Kiem tra host, CA, tai khoan va quyen topic.\n",
                        mqtt.state());
          tlsClient.stop();
          mqttRetryMs = mqttRetryMs < MQTT_RETRY_MAX_MS / 2
                            ? mqttRetryMs * 2 : MQTT_RETRY_MAX_MS;
        }
      }
      vTaskDelay(pdMS_TO_TICKS(50));
      continue;
    }

    if (!mqtt.loop()) {
      tlsClient.stop();
      lastMqttAttempt = millis();
      forcePublish = true;
      vTaskDelay(pdMS_TO_TICKS(50));
      continue;
    }

    // Đọc telemetry từ queue và publish lên MQTT
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
