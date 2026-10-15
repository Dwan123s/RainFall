# 🌧️ RainSense — Smart Rainfall & Environmental Monitoring System

[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14_App_Router-black.svg)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_/_NeonDB-336791.svg)](https://neon.tech/)
[![MQTT over TLS](https://img.shields.io/badge/IoT-HiveMQ_Cloud_TLS-FF6600.svg)](https://www.hivemq.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**RainSense** là hệ thống giám sát khí tượng và đo mưa thông minh quy chuẩn công nghiệp, kết nối phần cứng vi điều khiển **ESP32-S3**, cảm biến môi trường kỹ thuật số **BME280** (Nhiệt độ, Độ ẩm, Khí áp), và cảm biến **Hall A3144** gắn trên phễu lật đo mưa (Tipping Bucket Rain Gauge).

Dự án được xây dựng theo kiến trúc monorepo hoàn chỉnh gồm:
1. **Frontend (`apps/web`):** Next.js App Router, Tailwind CSS, Recharts, TanStack Query, React Hook Form, Dark/Light mode, giao diện tiếng Việt chuyên nghiệp.
2. **Backend (`apps/server`):** Node.js TypeScript API, Socket.IO truyền phát thời gian thực, MQTT.js qua TLS mã hóa với HiveMQ Cloud, Zod validation, khử trùng lặp bản tin idempotent.
3. **Shared (`packages/shared`):** Định nghĩa kiểu TypeScript, schema Zod, công thức khí tượng học (Magnus-Tetens, Rothfusz, cửa sổ trượt).
4. **Cơ sở dữ liệu (`prisma`):** PostgreSQL / NeonDB, Prisma ORM, migrations, seed script.
5. **Giả lập (`StationSimulator`):** Tích hợp chế độ DEMO MODE tạo dữ liệu khí tượng thực tế và thử nghiệm nhịp lật đo mưa tức thì.

---

## 🏛️ Kiến Trúc Hệ Thống (System Architecture)

```
[ ESP32-S3 + BME280 + A3144 Hall ]
                │
                ▼  (Wi-Fi / MQTTS Port 8883 - TLS)
     [ HiveMQ Cloud MQTT Broker ]
                │
                ▼  (Server-Side Subscription & Ingestion)
     [ Node.js Backend Server ] ────── (Idempotent Deduplication) ──────► [ PostgreSQL / NeonDB ]
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
Từ thư mục gốc `d:\IOTPROJECT`:
```powershell
npm install
```

### 3. Cấu hình biến môi trường
File `.env` mẫu đã được cấu hình sẵn tại gốc dự án và `apps/web/.env.local`. Bạn có thể tùy chỉnh các tham số:
```env
PORT=5000
DATABASE_URL="postgresql://user:password@ep-sample.ap-southeast-1.aws.neon.tech/rainsense?sslmode=require"
MQTT_BROKER_URL="tls://your-cluster-id.s1.eu.hivemq.cloud:8883"
MQTT_USERNAME="your_username"
MQTT_PASSWORD="your_password"
DEMO_MODE=true
```

### 4. Chạy kiểm thử tự động (Unit & Integration Tests)
```powershell
npm test
```
*Kết quả:* 10/10 kiểm thử vượt qua thành công:
- Khử lặp bản tin MQTT (`messageId`, `eventId`).
- Tính toán lượng mưa tích lũy và cường độ mưa theo cửa sổ trượt.
- Công thức điểm sương Magnus-Tetens và chỉ số nhiệt Rothfusz.
- Mốc ranh giới nửa đêm múi giờ `Asia/Ho_Chi_Minh`.
- Cơ chế phát hiện trạm ngắt kết nối (Device Offline / Stale).

### 5. Khởi động hệ thống phát triển
Chạy đồng thời cả Backend Server và Frontend Next.js chỉ với 1 câu lệnh:
```powershell
npm run dev
```
- **Web Dashboard:** [http://localhost:3000](http://localhost:3000)
- **Backend API & Socket.IO:** [http://localhost:5000](http://localhost:5000)
- **Health Check:** [http://localhost:5000/health](http://localhost:5000/health)

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

## 🛠️ Tích Hợp Phần Cứng ESP32-S3

1. **Sơ đồ đấu nối & Mã nguồn Firmware:** Xem chi tiết tại [docs/ESP32_FIRMWARE_GUIDE.md](docs/ESP32_FIRMWARE_GUIDE.md).
2. **Quy chuẩn Bản tin MQTT (Topic & JSON):** Xem chi tiết tại [docs/MQTT_SPECIFICATION.md](docs/MQTT_SPECIFICATION.md).

---

## 🚢 Hướng Dẫn Triển Khai Sản Xuất (Deployment)

1. **Cơ sở dữ liệu:** Tạo cơ sở dữ liệu Serverless miễn phí tại [Neon.tech](https://neon.tech), dán chuỗi kết nối vào `DATABASE_URL` trong file `.env`. Chạy `npm run prisma:push --workspace=@rainsense/server` để tự động tạo bảng.
2. **Backend Server:** Triển khai Node.js Server lên Render, Railway, DigitalOcean hoặc máy chủ VPS để duy trì kết nối Socket.IO và MQTT TLS lâu dài.
3. **Frontend Dashboard:** Triển khai `apps/web` lên Vercel với các biến môi trường:
   - `NEXT_PUBLIC_API_URL`: URL của Backend Server
   - `NEXT_PUBLIC_SOCKET_URL`: URL của Backend Server

---

## 📄 Bản Quyền
Dự án được phân phối dưới giấy phép MIT License.
