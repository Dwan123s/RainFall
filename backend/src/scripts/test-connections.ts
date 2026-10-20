import { env } from '../config/env';
import { testPrismaConnectionDetail, isAivenDatabase, getMaskedDatabaseUrl } from '../db/prisma';
import mqtt, { IClientOptions } from 'mqtt';
import { normalizeBrokerUrl } from '../mqtt/client';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

async function testDatabase() {
  console.log(`\n${BOLD}${CYAN}====================================================${RESET}`);
  console.log(`${BOLD}1. KIỂM TRA KẾT NỐI DATABASE (AIVEN POSTGRESQL)${RESET}`);
  console.log(`${CYAN}====================================================${RESET}`);

  const isAiven = isAivenDatabase();
  const maskedEndpoint = getMaskedDatabaseUrl();

  console.log(`Endpoint:    ${maskedEndpoint}`);
  console.log(`Provider:    ${isAiven ? `${GREEN}Aiven Cloud PostgreSQL${RESET}` : 'PostgreSQL'}`);

  const result = await testPrismaConnectionDetail();

  if (result.success) {
    console.log(`Trạng thái:  ${GREEN}✓ KẾT NỐI THÀNH CÔNG (${result.latencyMs}ms)${RESET}`);
    console.log(`Phiên bản:   ${result.version.split('\n')[0]}`);
    console.log(`Số bảng:     ${result.tables.length > 0 ? `${GREEN}${result.tables.length} bảng${RESET}` : `${YELLOW}0 bảng (Chưa chạy prisma db push)${RESET}`}`);
    if (result.tables.length > 0) {
      console.log(`Danh sách:   ${result.tables.join(', ')}`);
    } else {
      console.log(`\n${YELLOW}⚠️  LƯU Ý: Database đã kết nối nhưng chưa có bảng nào!${RESET}`);
      console.log(`👉 Chạy lệnh: ${BOLD}npm run db:push${RESET} để tạo các bảng tự động trên Aiven.`);
    }
    return true;
  } else {
    console.log(`Trạng thái:  ${RED}✗ KẾT NỐI THẤT BẠI (${result.latencyMs}ms)${RESET}`);
    console.log(`Chi tiết:    ${RED}${result.message}${RESET}`);
    if (isAiven) {
      console.log(`\n${YELLOW}💡 Gợi ý khắc phục lỗi kết nối Aiven PostgreSQL:${RESET}`);
      console.log(`  1. Kiểm tra chuỗi DATABASE_URL trong file .env có chứa "?sslmode=require" chưa.`);
      console.log(`  2. Kiểm tra tài khoản (avnadmin) và mật khẩu trong Aiven Console.`);
      console.log(`  3. Kiểm tra xem IP máy của bạn có bị chặn bởi IP Allowlist trong Aiven không.`);
    }
    return false;
  }
}

async function testMqttBroker(): Promise<boolean> {
  console.log(`\n${BOLD}${CYAN}====================================================${RESET}`);
  console.log(`${BOLD}2. KIỂM TRA KẾT NỐI MQTT BROKER (EMQX)${RESET}`);
  console.log(`${CYAN}====================================================${RESET}`);

  const rawUrl = env.MQTT_BROKER_URL;
  const brokerUrl = normalizeBrokerUrl(rawUrl);

  console.log(`Broker URL:  ${brokerUrl}`);
  console.log(`Client ID:   ${env.MQTT_CLIENT_ID}-test-probe`);
  console.log(`Xác thực:    ${env.MQTT_USERNAME ? `${GREEN}Có (Username: ${env.MQTT_USERNAME})${RESET}` : `${YELLOW}Không (Anonymous)${RESET}`}`);
  console.log(`TLS Verify:  ${env.MQTT_REJECT_UNAUTHORIZED ? 'Strict (rejectUnauthorized: true)' : `${YELLOW}Relaxed (rejectUnauthorized: false)${RESET}`}`);

  const isTls =
    brokerUrl.startsWith('mqtts://') ||
    brokerUrl.startsWith('tls://') ||
    brokerUrl.startsWith('ssl://') ||
    brokerUrl.includes(':8883');

  const start = Date.now();

  return new Promise((resolve) => {
    const opts: IClientOptions = {
      clientId: `rainsense-test-${Math.random().toString(16).substring(2, 8)}`,
      clean: true,
      connectTimeout: 8000,
      username: env.MQTT_USERNAME || undefined,
      password: env.MQTT_PASSWORD || undefined
    };

    if (isTls) {
      opts.rejectUnauthorized = env.MQTT_REJECT_UNAUTHORIZED;
    }

    let client: mqtt.MqttClient | null = null;
    let finished = false;

    const cleanup = () => {
      try {
        if (client) {
          client.removeAllListeners();
          client.end(true);
        }
      } catch {
        // ignore
      }
    };

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        cleanup();
        console.log(`Trạng thái:  ${RED}✗ TIMEOUT sau 8000ms${RESET}`);
        console.log(`Chi tiết:    Không nhận được phản hồi kết nối từ broker ${brokerUrl}`);
        resolve(false);
      }
    }, 8500);

    try {
      client = mqtt.connect(brokerUrl, opts);

      client.on('connect', () => {
        const latency = Date.now() - start;
        console.log(`Trạng thái:  ${GREEN}✓ KẾT NỐI THÀNH CÔNG (${latency}ms)${RESET}`);

        // Perform test message round-trip
        const testTopic = `${env.MQTT_TOPIC_PREFIX}/system/test-probe`;
        const testPayload = JSON.stringify({
          probe: 'OK',
          timestamp: new Date().toISOString()
        });

        client?.subscribe(testTopic, (subErr) => {
          if (subErr) {
            if (!finished) {
              finished = true;
              clearTimeout(timer);
              cleanup();
              console.log(`Subscribe:   ${RED}✗ Thất bại (${subErr.message})${RESET}`);
              resolve(false);
            }
            return;
          }

          console.log(`Subscribe:   ${GREEN}✓ Thành công topic ${testTopic}${RESET}`);

          client?.publish(testTopic, testPayload, { qos: 0 }, (pubErr) => {
            if (pubErr) {
              if (!finished) {
                finished = true;
                clearTimeout(timer);
                cleanup();
                console.log(`Publish:     ${RED}✗ Thất bại (${pubErr.message})${RESET}`);
                resolve(false);
              }
              return;
            }
            console.log(`Publish:     ${GREEN}✓ Phát bản tin test ping thành công${RESET}`);
          });
        });
      });

      client.on('message', (topic, payload) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          const totalMs = Date.now() - start;
          console.log(`Round-trip:  ${GREEN}✓ Nhận lại bản tin thành công (${totalMs}ms)${RESET}`);
          cleanup();
          resolve(true);
        }
      });

      client.on('error', (err) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          cleanup();
          console.log(`Trạng thái:  ${RED}✗ KẾT NỐI THẤT BẠI${RESET}`);
          console.log(`Chi tiết:    ${RED}${err.message}${RESET}`);

          console.log(`\n${YELLOW}💡 Gợi ý khắc phục lỗi kết nối EMQX MQTT:${RESET}`);
          if (err.message.includes('DEPTH_ZERO_SELF_SIGNED_CERT') || err.message.includes('SELF_SIGNED_CERT')) {
            console.log(`  👉 Thêm vào file .env: MQTT_REJECT_UNAUTHORIZED=false`);
          } else if (err.message.includes('ECONNREFUSED')) {
            console.log(`  👉 Kiểm tra EMQX Broker đã chạy chưa và cổng ${brokerUrl} đã được mở chưa.`);
          } else {
            console.log(`  👉 Kiểm tra lại MQTT_BROKER_URL, MQTT_USERNAME, MQTT_PASSWORD trong file .env.`);
          }
          resolve(false);
        }
      });
    } catch (e: any) {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        cleanup();
        console.log(`Trạng thái:  ${RED}✗ Lỗi khởi tạo: ${e.message}${RESET}`);
        resolve(false);
      }
    }
  });
}

async function main() {
  console.log(`\n${BOLD}🔍 RAINSENSE INFRASTRUCTURE VERIFICATION PROBE${RESET}`);
  console.log(`Kiểm tra kết nối EMQX MQTT Broker & Aiven PostgreSQL Database...`);

  const dbOk = await testDatabase();
  const mqttOk = await testMqttBroker();

  console.log(`\n${BOLD}${CYAN}====================================================${RESET}`);
  console.log(`${BOLD}TỔNG KẾT KIỂM TRA HẠ TẦNG${RESET}`);
  console.log(`${CYAN}====================================================${RESET}`);
  console.log(`Aiven PostgreSQL:  ${dbOk ? `${GREEN}SẴN SÀNG HOẠT ĐỘNG ✓${RESET}` : `${RED}CHƯA SẴN SÀNG ✗${RESET}`}`);
  console.log(`EMQX MQTT Broker:  ${mqttOk ? `${GREEN}SẴN SÀNG HOẠT ĐỘNG ✓${RESET}` : `${RED}CHƯA SẴN SÀNG ✗${RESET}`}`);

  if (dbOk && mqttOk) {
    console.log(`\n${GREEN}${BOLD}🎉 TẤT CẢ KẾT NỐI ĐỀU THÀNH CÔNG! Bạn có thể khởi động server bằng:${RESET}`);
    console.log(`   ${BOLD}npm run dev${RESET}\n`);
    process.exit(0);
  } else {
    console.log(`\n${YELLOW}${BOLD}⚠️  Có dịch vụ chưa kết nối thành công. Vui lòng kiểm tra lại file .env!${RESET}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error during connection probe:', err);
  process.exit(1);
});
