# 🌧️ RainSense — Smart Rainfall & Environmental Monitoring System

[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14_App_Router-black.svg)](https://nextjs.org/)
[![Database Aiven](https://img.shields.io/badge/Database-Aiven_PostgreSQL-FF1053.svg)](https://aiven.io/)
[![MQTT EMQX](https://img.shields.io/badge/MQTT-EMQX_Broker-00B175.svg)](https://www.emqx.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**RainSense** là hệ thống giám sát khí tượng và đo mưa thông minh quy chuẩn công nghiệp, kết nối phần cứng vi điều khiển **ESP32-S3**, cảm biến môi trường kỹ thuật số **BME280** (Nhiệt độ, Độ ẩm, Khí áp), và cảm biến **Hall A3144** gắn trên phễu lật đo mưa (Tipping Bucket Rain Gauge).

Dự án được xây dựng theo kiến trúc monorepo hoàn chỉnh gồm:
1. **Frontend (`apps/web`):** Next.js App Router, Tailwind CSS, Recharts, TanStack Query, React Hook Form, Dark/Light mode, giao diện tiếng Việt chuyên nghiệp.
2. **Backend (`apps/server`):** Node.js TypeScript API, Socket.IO truyền phát thời gian thực, MQTT.js kết nối **EMQX MQTT Broker** (TCP/TLS), Zod validation, khử trùng lặp bản tin idempotent.
3. **Shared (`packages/shared`):** Định nghĩa kiểu TypeScript, schema Zod, công thức khí tượng học (Magnus-Tetens, Rothfusz, cửa sổ trượt).
4. **Cơ sở dữ liệu (`prisma`):** **Aiven PostgreSQL Cloud**, Prisma ORM, migrations, seed script.
5. **Giả lập (`StationSimulator`):** Tích hợp chế độ DEMO MODE tạo dữ liệu khí tượng thực tế và thử nghiệm nhịp lật đo mưa tức thì.

---

## 🏛️ Kiến Trúc Hệ Thống (System Architecture)

```
[ ESP32-S3 + BME280 + A3144 Hall ]
                │
                ▼  (Wi-Fi / MQTT 1883 hoặc MQTTS TLS 8883)
      [ EMQX MQTT Broker ]
                │
                ▼  (Server-Side Subscription & Ingestion)
     [ Node.js Backend Server ] ────── (Idempotent Deduplication) ──────► [ Aiven PostgreSQL Cloud ]
                │
                ▼  (Socket.IO Realtime Broadcast)
  [ RainSense Next.js Web Dashboard ]
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng (Quick Start)

### 1. Yêu cầu môi trường
- **Node.js:** v18.0.0+ hoặc v20.x LTS
- **npm:** v9.x+

### 2. Cài đặt các gói phụ thuộc (Monorepo Workspaces)
```powershell
npm install
```

### 3. Cấu hình biến môi trường
File `.env` mẫu đã được cấu hình sẵn tại gốc dự án (`.env.example` và `.env`):
```env
# Database Aiven PostgreSQL (Bắt buộc có ?sslmode=require)
DATABASE_URL="postgresql://avnadmin:YOUR_PASSWORD@pg-cluster.aivencloud.com:12345/defaultdb?sslmode=require"

# EMQX MQTT Broker (Dùng broker test công cộng hoặc EMQX Cloud TLS)
MQTT_BROKER_URL="mqtt://broker.emqx.io:1883"
MQTT_USERNAME=""
MQTT_PASSWORD=""
DEMO_MODE=false
```

### 4. Kiểm tra kết nối hạ tầng (Aiven & EMQX)
Chạy lệnh chẩn đoán tự động:
```powershell
npm run test:conn
```

### 5. Khởi tạo cấu trúc bảng trên Aiven Database
```powershell
npm run db:push
npm run db:seed
```

### 6. Khởi động hệ thống
Chạy đồng thời cả Backend Server và Frontend Next.js chỉ với 1 câu lệnh:
```powershell
npm run dev
```
- **Web Dashboard:** [http://localhost:3000](http://localhost:3000)
- **Backend API & Socket.IO:** [http://localhost:5000](http://localhost:5000)
- **Health Check & Diagnostics:** [http://localhost:5000/health](http://localhost:5000/health)

---

## 📊 Các Trang Tính Năng Chính (Core Pages)

| Trang | Đường dẫn | Mô tả chức năng |
|---|---|---|
| **Tổng quan** | `/overview` | Trạng thái trạm, 4 thẻ đo môi trường tức thời, biểu đồ thời gian thực, tổng hợp mưa, sức khỏe phần cứng |
| **Phân tích mưa** | `/rainfall` | Thống kê tích lũy (hôm nay, hôm qua, 24h, 7 ngày, tháng), cường độ mưa đỉnh, xung lật cảm biến Hall A3144 |
| **Môi trường** | `/environmental` | Biến thiên nhiệt độ, độ ẩm, áp suất, điểm sương (Dew Point), tương quan và xu hướng khí áp 3 giờ |
| **Quản lý trạm** | `/devices` | Danh sách thiết bị, hiệu chuẩn mm/tip theo từng trạm, quy trình Command & Ack điều khiển từ xa |
| **Cảnh báo** | `/alerts` | Cấu hình ngưỡng cảnh báo (mưa lớn, nhiệt độ cao/thấp), danh sách sự kiện, xác nhận đã xử lý |
| **Dữ liệu lịch sử** | `/history` | Bảng dữ liệu phân trang máy chủ, bộ lọc thời gian, đồ thị biến thiên, xuất báo cáo CSV |
| **Cài đặt** | `/settings` | Chuyển đổi linh hoạt giữa LIVE MODE và DEMO MODE, kiểm tra kết nối Broker MQTT |

---

## 🛠️ Tài Liệu Kỹ Thuật

1. **Hướng dẫn kết nối EMQX & Aiven:** Xem chi tiết tại [docs/EMQX_AIVEN_GUIDE.md](docs/EMQX_AIVEN_GUIDE.md).
2. **Sơ đồ đấu nối & Mã nguồn ESP32-S3:** Xem chi tiết tại [docs/ESP32_FIRMWARE_GUIDE.md](docs/ESP32_FIRMWARE_GUIDE.md).
3. **Quy chuẩn Bản tin MQTT (Topic & JSON):** Xem chi tiết tại [docs/MQTT_SPECIFICATION.md](docs/MQTT_SPECIFICATION.md).

---

## 📄 Bản Quyền
Dự án được phân phối dưới giấy phép MIT License.
