export function renderStatusPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Smart Weather IoT System — Backend Monitor</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: radial-gradient(circle at 50% 20%, #151c2f 0%, #0b0f19 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      width: 100%;
      max-width: 620px;
      background: #13192b;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 28px;
      box-shadow: 0 30px 70px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05);
      padding: 36px 32px 28px;
      position: relative;
      overflow: hidden;
    }
    .container::before {
      content: '';
      position: absolute;
      top: -100px;
      left: 50%;
      transform: translateX(-50%);
      width: 350px;
      height: 200px;
      background: radial-gradient(ellipse, rgba(56, 189, 248, 0.15), transparent 70%);
      pointer-events: none;
    }
    .header {
      text-align: center;
      margin-bottom: 28px;
    }
    .title {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 14.5px;
      color: #94a3b8;
      font-weight: 500;
    }
    .status-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 22px;
    }
    @media (max-width: 480px) {
      .status-grid {
        grid-template-columns: 1fr;
      }
    }
    .status-card {
      background: #182035;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 18px;
      padding: 18px 20px;
      text-align: center;
      transition: transform 0.2s, border-color 0.2s;
    }
    .status-card:hover {
      border-color: rgba(255, 255, 255, 0.12);
      transform: translateY(-2px);
    }
    .status-label {
      font-size: 11.5px;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .status-value {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 14.5px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      position: relative;
    }
    .status-connected {
      color: #10b981;
    }
    .status-connected .status-dot {
      background: #10b981;
      box-shadow: 0 0 12px #10b981;
    }
    .status-connected .status-dot::after {
      content: '';
      position: absolute;
      top: -2px;
      left: -2px;
      right: -2px;
      bottom: -2px;
      border-radius: 50%;
      border: 2px solid rgba(16, 185, 129, 0.4);
      animation: pulse-ring 2s infinite;
    }
    .status-disconnected {
      color: #ef4444;
    }
    .status-disconnected .status-dot {
      background: #ef4444;
      box-shadow: 0 0 12px #ef4444;
    }
    .status-sub {
      display: block;
      font-size: 11px;
      color: #94a3b8;
      font-weight: 500;
      margin-top: 8px;
      word-break: break-all;
      line-height: 1.35;
    }
    @keyframes pulse-ring {
      0% { transform: scale(1); opacity: 0.8; }
      100% { transform: scale(1.8); opacity: 0; }
    }
    .sensor-card {
      background: #182035;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 20px;
      padding: 22px 24px;
      margin-bottom: 24px;
    }
    .sensor-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      margin-bottom: 18px;
    }
    .sensor-title {
      font-size: 16px;
      font-weight: 700;
      color: #f1f5f9;
    }
    .sensor-time {
      font-size: 12.5px;
      color: #64748b;
      font-weight: 500;
    }
    .sensor-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      row-gap: 20px;
      column-gap: 16px;
    }
    .sensor-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .sensor-item-label {
      font-size: 13px;
      color: #94a3b8;
      font-weight: 500;
    }
    .sensor-item-val {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .val-temp, .val-humid {
      color: #38bdf8;
    }
    .val-press {
      color: #818cf8;
    }
    .val-rain {
      color: #34d399;
    }
    .footer {
      text-align: center;
      font-size: 12.5px;
      color: #64748b;
      font-weight: 500;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
    }
    .live-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.2);
      padding: 4px 10px;
      border-radius: 999px;
    }
    .live-dot {
      width: 6px;
      height: 6px;
      background: #38bdf8;
      border-radius: 50%;
      animation: blink 1.5s infinite;
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">Smart Weather IoT System</h1>
      <p class="subtitle">Hệ thống giám sát trạm thời tiết thông minh API</p>
    </div>

    <div class="status-grid">
      <!-- Database Status -->
      <div class="status-card">
        <div class="status-label">Cơ Sở Dữ Liệu (Aiven)</div>
        <div id="db-status" class="status-value status-disconnected">
          <span class="status-dot"></span>
          <span id="db-text">DISCONNECTED</span>
        </div>
        <div id="db-sub" class="status-sub">Đang kiểm tra kết nối...</div>
      </div>

      <!-- MQTT Status -->
      <div class="status-card">
        <div class="status-label">Mạng Truyền Tin (EMQX)</div>
        <div id="mqtt-status" class="status-value status-disconnected">
          <span class="status-dot"></span>
          <span id="mqtt-text">DISCONNECTED</span>
        </div>
        <div id="mqtt-sub" class="status-sub">Đang kết nối Broker...</div>
      </div>
    </div>

    <!-- Current Sensor Values Card -->
    <div class="sensor-card">
      <div class="sensor-header">
        <span class="sensor-title">Thông số cảm biến hiện tại</span>
        <span id="data-time" class="sensor-time">Chưa có dữ liệu</span>
      </div>

      <div class="sensor-grid">
        <div class="sensor-item">
          <span class="sensor-item-label">Nhiệt độ</span>
          <span id="val-temp" class="sensor-item-val val-temp">N/A</span>
        </div>
        <div class="sensor-item">
          <span class="sensor-item-label">Độ ẩm</span>
          <span id="val-humid" class="sensor-item-val val-humid">N/A</span>
        </div>
        <div class="sensor-item">
          <span class="sensor-item-label">Khí áp</span>
          <span id="val-press" class="sensor-item-val val-press">N/A</span>
        </div>
        <div class="sensor-item">
          <span class="sensor-item-label">Lượng mưa & Cường độ</span>
          <span id="val-rain" class="sensor-item-val val-rain">N/A (N/A)</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="live-badge">
        <span class="live-dot"></span>
        <span>RainSense Realtime Engine Active</span>
      </div>
      <p>© 2026 Smart Weather Station. System Online & Active.</p>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    async function updateStatus() {
      try {
        const res = await fetch('/api/system/status');
        if (res.ok) {
          const json = await res.json();
          const d = json.data;

          // Database Status
          const dbEl = document.getElementById('db-status');
          const dbTxt = document.getElementById('db-text');
          const dbSub = document.getElementById('db-sub');
          if (d.database && d.database.connected) {
            dbEl.className = 'status-value status-connected';
            dbTxt.textContent = 'CONNECTED';
            dbSub.textContent = (d.database.type || 'Aiven PostgreSQL') + ' (' + (d.database.tablesCount || 0) + ' bảng)';
            dbSub.style.color = '#10b981';
          } else {
            dbEl.className = 'status-value status-disconnected';
            dbTxt.textContent = 'DISCONNECTED';
            dbSub.textContent = d.database.endpoint ? d.database.endpoint : 'Chưa kết nối';
            dbSub.style.color = '#f87171';
          }

          // MQTT Status
          const mqttEl = document.getElementById('mqtt-status');
          const mqttTxt = document.getElementById('mqtt-text');
          const mqttSub = document.getElementById('mqtt-sub');
          if (d.mqtt && (d.mqtt.connected || d.mqtt.status === 'CONNECTED')) {
            mqttEl.className = 'status-value status-connected';
            mqttTxt.textContent = 'CONNECTED';
            mqttSub.textContent = d.mqtt.broker || 'Đã kết nối';
            mqttSub.style.color = '#10b981';
          } else {
            mqttEl.className = 'status-value status-disconnected';
            mqttTxt.textContent = 'DISCONNECTED';
            let errMsg = 'Chưa thể kết nối tới Broker';
            if (d.mqtt.hint) {
              errMsg = d.mqtt.hint;
            } else if (d.mqtt.lastError) {
              errMsg = d.mqtt.lastError;
            } else if (d.mqtt.broker) {
              errMsg = 'Đang thử kết nối ' + d.mqtt.broker;
            }
            mqttSub.textContent = errMsg;
            mqttSub.style.color = '#f87171';
          }
        }
      } catch (e) {
        console.warn('Status poll error:', e);
      }
    }

    async function updateTelemetry() {
      try {
        const res = await fetch('/api/dashboard/summary');
        if (res.ok) {
          const json = await res.json();
          const d = json.data;
          const meas = d.latestMeasurement;
          const rain = d.rainfall;

          if (meas) {
            document.getElementById('val-temp').textContent = meas.temperature !== undefined ? meas.temperature.toFixed(1) + ' °C' : 'N/A';
            document.getElementById('val-humid').textContent = meas.humidity !== undefined ? meas.humidity.toFixed(1) + ' %' : 'N/A';
            document.getElementById('val-press').textContent = meas.pressure !== undefined ? meas.pressure.toFixed(1) + ' hPa' : 'N/A';

            const timeStr = new Date(meas.timestamp).toLocaleTimeString('vi-VN');
            document.getElementById('data-time').textContent = 'Cập nhật: ' + timeStr;
          }

          if (rain) {
            const todayMm = rain.todayMm !== undefined ? rain.todayMm.toFixed(1) + ' mm' : '0.0 mm';
            const rateMmH = rain.currentRateMmH !== undefined ? rain.currentRateMmH.toFixed(1) + ' mm/h' : '0.0 mm/h';
            document.getElementById('val-rain').textContent = todayMm + ' (' + rateMmH + ')';
          }
        }
      } catch (e) {
        console.warn('Telemetry poll error:', e);
      }
    }

    // Initial fetch
    updateStatus();
    updateTelemetry();

    // Auto poll every 2.5 seconds
    setInterval(updateStatus, 2500);
    setInterval(updateTelemetry, 2500);

    // Socket.IO realtime listener
    try {
      if (typeof io !== 'undefined') {
        const socket = io();
        socket.on('telemetry:new', (payload) => {
          updateTelemetry();
        });
        socket.on('rain:new', () => {
          updateTelemetry();
        });
      }
    } catch (e) {
      // fallback to polling
    }
  </script>
</body>
</html>`;
}
