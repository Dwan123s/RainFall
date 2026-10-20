# 🚀 Hướng Dẫn Triển Khai Backend RainSense Lên Render (Render.com)

Tài liệu này hướng dẫn chi tiết cách deploy phần **Backend (Node.js API + Socket.IO + EMQX MQTT Ingestion + Aiven PostgreSQL)** lên nền tảng đám mây **Render**.

---

## 📑 Mục Lục
1. [Cách 1: Triển khai tự động bằng Render Blueprint (Khuyên dùng)](#-cách-1-triển-khai-tự-động-bằng-render-blueprint-khuyên-dùng)
2. [Cách 2: Triển khai thủ công từng bước (Manual Web Service)](#-cách-2-triển-khai-thủ-công-từng-bước)
3. [Danh sách biến môi trường (Environment Variables)](#-danh-sách-biến-môi-trường)
4. [Mẹo giữ Render Free Tier chạy 24/7 không bị Sleep](#-mẹo-giữ-render-free-tier-chạy-247-không-bị-sleep)
5. [Kiểm tra sau khi Deploy](#-kiểm-tra-sau-khi-deploy)

---

## ⚡ Cách 1: Triển Khai Tự Động Bằng Render Blueprint (Khuyên dùng)

Dự án đã có sẵn file cấu hình [`render.yaml`](../render.yaml) ở thư mục gốc.

1. Truy cập [Render Dashboard](https://dashboard.render.com/) và đăng nhập (bằng tài khoản GitHub).
2. Bấm nút **New +** ở góc phải trên cùng ➔ Chọn **Blueprint**.
3. Chọn kho lưu trữ GitHub của bạn: `huuv201151/IOTPROJECT`.
4. Render sẽ tự động đọc file `render.yaml` và nhận diện service `rainsense-backend`.
5. Điền các biến môi trường nhạy cảm:
   - `DATABASE_URL`: Chuỗi kết nối Aiven PostgreSQL của bạn (kèm `?sslmode=require`).
   - `MQTT_BROKER_URL`: URL broker EMQX (ví dụ `mqtt://broker.emqx.io:1883` hoặc `mqtts://...:8883`).
   - `MQTT_USERNAME` / `MQTT_PASSWORD`: Tài khoản EMQX (nếu có).
   - `ADMIN_PASSWORD`: Mật khẩu tài khoản quản trị hệ thống.
6. Bấm **Apply**. Render sẽ tự động cài đặt package, build TypeScript và kích hoạt Backend!

---

## 🛠️ Cách 2: Triển Khai Thủ Công Từng Bước

Nếu muốn cấu hình thủ công từng bước:

### Bước 1: Tạo Web Service mới
1. Trên [Render Dashboard](https://dashboard.render.com/), bấm **New +** ➔ **Web Service**.
2. Chọn kho lưu trữ: `huuv201151/IOTPROJECT`.

### Bước 2: Điền thông số cấu hình chính
| Mục cấu hình | Giá trị thiết lập | Ghi chú |
|---|---|---|
| **Name** | `rainsense-backend` | Tên service hiển thị trên Render |
| **Region** | `Singapore (Southeast Asia)` | Gần Việt Nam nhất, độ trễ thấp (< 40ms) |
| **Branch** | `main` | Nhánh Git sản xuất |
| **Runtime** | `Node` | Môi trường Node.js LTS |
| **Build Command** | `npm install && npm run build:server` | Cài đặt package, generate Prisma & compile TypeScript |
| **Start Command** | `npm run start:server` | Chạy server Node.js sản xuất |
| **Instance Type** | `Free` | Miễn phí hoặc nâng cấp `Starter` ($7/tháng) |

### Bước 3: Cấu hình Health Check Path
- Bấm vào mục **Advanced**:
- **Health Check Path**: `/health`

---

## 🔐 Danh Sách Biến Môi Trường (Environment Variables)

Tại mục **Environment Variables** trên Render, thêm các biến sau:

| Tên biến (Key) | Giá trị mẫu (Value) | Giải thích |
|---|---|---|
| `NODE_ENV` | `production` | Chế độ chạy sản xuất |
| `DATABASE_URL` | `postgresql://avnadmin:PASS@pg-xxx.aivencloud.com:12345/defaultdb?sslmode=require` | Chuỗi kết nối Aiven PostgreSQL Cloud |
| `MQTT_BROKER_URL` | `mqtt://broker.emqx.io:1883` | URL EMQX Broker (hoặc `mqtts://...:8883`) |
| `MQTT_USERNAME` | `""` hoặc user của bạn | Tên đăng nhập EMQX (nếu có) |
| `MQTT_PASSWORD` | `""` hoặc pass của bạn | Mật khẩu EMQX (nếu có) |
| `MQTT_REJECT_UNAUTHORIZED` | `true` | Kiểm tra SSL của MQTT Broker |
| `DEMO_MODE` | `false` | Nhận dữ liệu thật từ EMQX & lưu Aiven |
| `CORS_ORIGIN` | `*` | Cho phép Web Dashboard kết nối API & Socket.IO |
| `JWT_SECRET` | `rainsense_super_secure_jwt_secret_key_at_least_32_characters` | Khóa bí mật mã hóa JWT Token |
| `ADMIN_EMAIL` | `admin@rainsense.io` | Email đăng nhập ban đầu |
| `ADMIN_PASSWORD` | `Admin@123456` | Mật khẩu đăng nhập ban đầu |
| `DEFAULT_STATION_ID` | `RS-ESP32S3-01` | Mã trạm mặc định |
| `DEFAULT_TIMEZONE` | `Asia/Ho_Chi_Minh` | Múi giờ Việt Nam (UTC+7) |

---

## ⏰ Mẹo Giữ Render Free Tier Chạy 24/7 Không Bị Sleep

Trên gói **Free Tier**, Render sẽ tự động chuyển Web Service sang chế độ ngủ (Spin down/Sleep) nếu không có truy vấn HTTP nào trong vòng 15 phút. Khi trạm ESP32-S3 gửi dữ liệu qua MQTT, server có thể bị ngắt quãng nếu đang ngủ.

### Giải pháp giữ thức 100% miễn phí (Always Awake):
1. Đăng ký tài khoản miễn phí tại [UptimeRobot.com](https://uptimerobot.com/) hoặc [Cron-job.org](https://cron-job.org/).
2. Bấm **Add New Monitor**:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `RainSense Backend Keepalive`
   - **URL:** `https://<ten-service-cua-ban>.onrender.com/health`
   - **Monitoring Interval:** `5 minutes` (mỗi 5 phút ping 1 lần)
3. Lưu lại. Render sẽ liên tục nhận HTTP request và **không bao giờ bị sleep**, đảm bảo kết nối EMQX MQTT và Socket.IO luôn trực tuyến 24/7!

---

## 🔍 Kiểm Tra Sau Khi Deploy

Sau khi Render báo `Deploy Live`, bạn có thể kiểm tra:

1. **Kiểm tra Health Check:**
   Mở trình duyệt truy cập:
   `https://<ten-service-cua-ban>.onrender.com/health`
   Kết quả trả về JSON:
   ```json
   {
     "status": "OK",
     "service": "RainSense IoT Backend",
     "mode": "LIVE",
     "database": {
       "connected": true,
       "provider": "PostgreSQL",
       "isAiven": true,
       "tablesCount": 8
     },
     "mqtt": {
       "connected": true,
       "status": "CONNECTED",
       "broker": "mqtt://broker.emqx.io:1883/"
     }
   }
   ```

2. **Kết nối Frontend Next.js ([`apps/web`](../apps/web)):**
   Nếu bạn deploy Frontend lên **Vercel** hoặc Render, cấu hình biến môi trường:
   - `NEXT_PUBLIC_API_URL` = `https://<ten-service-cua-ban>.onrender.com`
   - `NEXT_PUBLIC_SOCKET_URL` = `https://<ten-service-cua-ban>.onrender.com`
