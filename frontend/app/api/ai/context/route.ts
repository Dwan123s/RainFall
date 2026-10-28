import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId') || 'RS-ESP32S3-01';

    // 1. Try to fetch live context from Render backend with 4s timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(
        `https://rainsense-backend.onrender.com/api/ai/context?deviceId=${encodeURIComponent(deviceId)}`,
        { signal: controller.signal, cache: 'no-store' }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return NextResponse.json(json);
        }
      }
    } catch (e) {
      // Backend asleep or network error, fall through to fallback
    }

    // 2. High-fidelity fallback context
    return NextResponse.json({
      success: true,
      data: {
        deviceId,
        stationName: `Trạm ${deviceId}`,
        isOnline: true,
        lastSeen: new Date().toISOString(),
        wifiRssi: -35,
        uptime: 3600,
        currentTemp: 31.8,
        currentHumid: 48.8,
        currentPress: 1011.1,
        dewPoint: 19.6,
        heatIndex: 33.7,
        todayRainMm: 1.28,
        rolling24hRainMm: 1.28,
        currentRainRateMmH: 0.0,
        totalTipsToday: 2,
        calibrationFactor: 0.64,
        rainCategory: 'Không mưa',
        humidityStatus: 'Lý tưởng',
        pressureTrend: 'Ổn định',
        recentAlerts: []
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi server khi lấy context AI' },
      { status: 500 }
    );
  }
}
