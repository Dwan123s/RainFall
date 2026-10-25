import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { message, history = [], deviceId = 'RS-ESP32S3-01' } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ success: false, error: 'Thiếu nội dung câu hỏi' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Chưa cấu hình GEMINI_API_KEY trên môi trường Vercel'
      }, { status: 500 });
    }

    const systemPrompt = `Bạn là RainSense AI — Trợ lý Khí tượng & Giám sát Mưa Đô thị thông minh trực thuộc hệ thống trạm quan trắc RainSense (kết nối ESP32-S3, BME280 và cảm biến lật gầu Hall A3144 qua EMQX Cloud MQTT và Aiven PostgreSQL).
Tính cách & Phong cách: Chuyên nghiệp, nhã nhặn, am hiểu sâu sắc về khoa học khí quyển và kỹ thuật phần cứng IoT. Sử dụng văn phong tiếng Việt chuẩn mực, mạch lạc, có cấu trúc bullet point rõ ràng, bảng biểu khi cần và các biểu tượng thời tiết trực quan (🌧️, 🌡️, 💧, 🧭, ⚡, ⚠️).
Kiến thức chuyên môn:
- Công thức tính mưa gầu lật: Lượng mưa (mm) = Số nhịp (tips) * 0.64 mm/tip.
- Cường độ mưa (Rain Rate): Tính theo cửa sổ trượt 5 phút quy đổi về mm/h.
- Cảm biến môi trường BME280: Nhiệt độ, Độ ẩm tương đối, Khí áp, Điểm sương Magnus-Tetens, Chỉ số nhiệt Rothfusz.
- Phần cứng ESP32-S3: I2C (SDA GPIO 8, SCL GPIO 9, xung 100kHz), Cảm biến Hall A3144 (GPIO 10, ngắt FALLING), Nút BOOT/Reset (GPIO 0).
- Kết nối: MQTT TLS 8883 (EMQX Cloud), Wi-Fi Multi tự động chuyển mạng.
Mã trạm quan trắc hiện tại: ${deviceId}.
Hãy trò chuyện tự nhiên, phân tích chuyên sâu các hiện tượng thời tiết và giải đáp kỹ thuật tận tình cho người dùng.`;

    const validHistory = (history || [])
      .filter((msg: any) => msg && typeof msg.content === 'string' && msg.content.trim() !== '')
      .slice(-6)
      .map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

    const contents = [
      ...validHistory,
      {
        role: 'user',
        parts: [{ text: message }]
      }
    ];

    const modelsToTry = ['gemini-3.5-flash', 'gemini-3.8-flash'];

    for (const model of modelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey
            },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemPrompt }]
              },
              contents,
              generationConfig: {
                thinkingConfig: { thinkingBudget: 0 },
                temperature: 0.7,
                maxOutputTokens: 1200
              }
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidate && candidate.trim().length > 0) {
            return NextResponse.json({
              success: true,
              data: {
                reply: candidate.trim(),
                context: { deviceId }
              }
            });
          }
        }
      } catch (err: any) {
        // continue
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        reply: `RainSense AI đã nhận câu hỏi: "${message}". Hiện tại hệ thống đang kết nối trực tiếp với trạm quan trắc ${deviceId}. Bạn cần hỗ trợ thêm thông tin gì về lượng mưa hoặc môi trường không?`,
        context: { deviceId }
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi server xử lý AI' },
      { status: 500 }
    );
  }
}
