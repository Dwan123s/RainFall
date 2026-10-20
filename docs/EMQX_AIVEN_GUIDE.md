# 📘 Hướng Dẫn Tích Hợp EMQX MQTT Broker & Cơ Sở Dữ Liệu Aiven PostgreSQL

Tài liệu này hướng dẫn chi tiết cách kết nối phần Backend của hệ thống **RainSense** với:
1. **EMQX MQTT Broker** (hỗ trợ EMQX Public, EMQX Cloud MQTTS TLS port 8883, hoặc EMQX Docker cục bộ).
2. **Aiven PostgreSQL Database** (Dịch vụ PostgreSQL Cloud có mã hóa SSL bắt buộc).

---

## 🏛️ Kiến Trúc Hệ Thống (System Architecture)

```
[ ESP32-S3 + BME280 + Cảm biến Hall A3144 ]
                   │
                   ▼  (MQTT Port 1883 hoặc MQTTS TLS Port 8883)
        [ EMQX MQTT Broker ]
                   │
                   ▼  (Subscription: weather/+/telemetry, rain, status)
       [ RainSense Backend Server ]
        ├── Idempotent Deduplication (Chống lặp bản tin)
        ├── Công thức khí tượng (Magnus-Tetens, Rothfusz, cửa sổ trượt)
        ├── Socket.IO Broadcast (Web Dashboard Realtime)
        └── Prisma ORM (SSL: require) ────────► [ Aiven PostgreSQL Cloud ]
```

---

## 🚀 Bước 1: Cấu Hình Cơ Sở Dữ Liệu Aiven PostgreSQL

### 1. Lấy chuỗi kết nối từ Aiven Console
1. Đăng nhập vào [Aiven Console](https://console.aiven.io/).
2. Chọn dịch vụ **PostgreSQL** của bạn.
3. Trong tab **Overview**, tìm mục **Connection information** và sao chép **Service URI**.
   - Chuỗi kết nối có dạng:
     ```
     postgres://avnadmin:SECRET_PASSWORD@pg-cluster-id.aivencloud.com:12345/defaultdb?sslmode=require
     ```
   - **Lưu ý quan trọng:** Aiven luôn bắt buộc có tham số `?sslmode=require`.

### 2. Điền vào file `.env`
Mở file `.env` tại thư mục gốc dự án:
```env
DATABASE_URL="postgresql://avnadmin:SECRET_PASSWORD@pg-cluster-id.aivencloud.com:12345/defaultdb?sslmode=require"
```

### 3. Đồng bộ cấu trúc bảng và khởi tạo dữ liệu mẫu (Seed)
Chạy lệnh sau để Prisma tự động tạo toàn bộ bảng trên Aiven PostgreSQL:
```powershell
npm run db:push
```
Sau đó khởi tạo tài khoản Admin và cấu hình trạm chuẩn:
```powershell
npm run db:seed
```

---

## 📡 Bước 2: Cấu Hình EMQX MQTT Broker

Hệ thống hỗ trợ linh hoạt 3 hình thức triển khai EMQX:

### Tùy chọn A: Dùng Broker Test Công Cộng (Sẵn sàng ngay không cần đăng ký)
Phù hợp để test nhanh trên máy tính:
```env
MQTT_BROKER_URL="mqtt://broker.emqx.io:1883"
MQTT_USERNAME=""
MQTT_PASSWORD=""
MQTT_REJECT_UNAUTHORIZED="true"
```

### Tùy chọn B: Dùng EMQX Cloud (Bảo mật TLS Port 8883)
1. Đăng ký tại [EMQX Cloud](https://cloud.emqx.com/) (gói Serverless miễn phí).
2. Tạo **Deployment**, vào mục **Authentication** tạo một `Username` và `Password` cho trạm.
3. Điền vào file `.env`:
```env
MQTT_BROKER_URL="mqtts://your-instance.emqx.cloud:8883"
MQTT_USERNAME="rainsense_station_user"
MQTT_PASSWORD="YourSecureMqttPassword"
MQTT_REJECT_UNAUTHORIZED="true"
# Nếu dùng CA cert riêng của EMQX Serverless:
# MQTT_CA_CERT="certs/emqxsl-ca.crt"
```

### Tùy chọn C: Chạy EMQX Cục Bộ bằng Docker
Nếu bạn muốn tự host EMQX trên máy cá nhân hoặc máy chủ riêng:
```powershell
docker run -d --name emqx -p 1883:1883 -p 8083:8083 -p 8084:8084 -p 8883:8883 -p 18083:18083 emqx/emqx:latest
```
- Dashboard EMQX: `http://localhost:18083` (User: `admin`, Pass: `public`)
- Cấu hình file `.env`:
```env
MQTT_BROKER_URL="mqtt://localhost:1883"
MQTT_USERNAME=""
MQTT_PASSWORD=""
```

---

## 🔍 Bước 3: Kiểm Tra Kết Nối Tự Động (Connection Verification)

Hệ thống đã tích hợp sẵn công cụ chẩn đoán hạ tầng. Chỉ cần chạy 1 lệnh:
```powershell
npm run test:conn
```

Công cụ sẽ thực hiện:
1. Kết nối thử tới **Aiven PostgreSQL**, đo độ trễ (latency), kiểm tra phiên bản và đếm các bảng dữ liệu.
2. Kết nối thử tới **EMQX Broker**, đăng ký topic và phát bản tin ping kiểm tra hai chiều (Round-trip test).
3. Đưa ra gợi ý sửa lỗi ngay lập tức nếu có bất kỳ thông số nào chưa chính xác.

---

## ⚡ Bước 4: Khởi Động Backend & Dashboard

Khi các kết nối đã sẵn sàng:
```powershell
npm run dev
```

- **Backend API & Socket.IO:** `http://localhost:5000`
- **Kiểm tra trạng thái hệ thống:**
  - `GET http://localhost:5000/health`
  - `GET http://localhost:5000/api/system/status`
- **Web Dashboard:** `http://localhost:3000`

---

## 📨 Thử Nghiệm Gửi Bản Tin MQTT Vào EMQX

Bạn có thể dùng công cụ [MQTTX](https://mqttx.app/) hoặc lệnh `mosquitto_pub` để bắn thử một bản tin đo đạc tới EMQX Broker:

### Topic:
```
weather/RS-ESP32S3-01/telemetry
```

### Payload JSON:
```json
{
  "messageId": "RS-ESP32S3-01-TEST-0001",
  "deviceId": "RS-ESP32S3-01",
  "timestamp": "2026-10-20T21:30:00.000Z",
  "temperature": 28.5,
  "humidity": 78.2,
  "pressure": 1008.4,
  "wifiRssi": -65,
  "uptime": 3600,
  "totalRainTips": 12,
  "rainRate": 0.0
}
```

Ngay sau khi gửi:
1. EMQX chuyển tiếp bản tin tới Backend Server.
2. Backend tự động giải mã, tính toán điểm sương, khử trùng lặp `messageId`.
3. Dữ liệu được ghi thẳng vào bảng `measurements` trên **Aiven PostgreSQL**.
4. Phát tức thời (Zero Latency) qua **Socket.IO** lên giao diện web Next.js!
