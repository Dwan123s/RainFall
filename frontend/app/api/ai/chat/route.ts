import { NextResponse } from 'next/server';
import {
  buildRainSensePrompt,
  generateRainSenseReply,
  cleanChatHistory,
  normalizeStationContext,
  cleanLatexArtifacts,
  StationContext,
  ChatTurn
} from '../../../../lib/rainsense-ai';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, history = [], deviceId, context } = body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Vui lòng cung cấp nội dung câu hỏi' },
        { status: 400 }
      );
    }

    const targetDeviceId =
      deviceId ||
      (typeof context === 'object' && context?.deviceId) ||
      process.env.NEXT_PUBLIC_DEFAULT_DEVICE_ID ||
      'RS-ESP32S3-01';

    // 1. Try to fetch fresh authoritative context from backend
    let safeContext: StationContext = normalizeStationContext(context, targetDeviceId);
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://rainsense-backend.onrender.com'
        : 'http://localhost:5000');

    try {
      const ctxRes = await fetch(`${apiBase}/api/ai/context?deviceId=${targetDeviceId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      });
      if (ctxRes.ok) {
        const json = await ctxRes.json();
        if (json?.success && json?.data) {
          safeContext = normalizeStationContext(json.data, targetDeviceId);
        }
      }
    } catch {
      // Backend unreachable; safeContext already holds client-provided/normalized fallback
    }

    const cleanedHistory: ChatTurn[] = cleanChatHistory(history);
    const apiKey = process.env.GEMINI_API_KEY;

    // 2. Call Gemini API if key is available
    if (apiKey) {
      const systemPrompt = buildRainSensePrompt(safeContext);
      const validHistory = cleanedHistory.map((msg) => ({
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

      const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash'];

      for (const model of modelsToTry) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: 'POST',
              signal: controller.signal,
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
                  temperature: 0.4,
                  maxOutputTokens: 1000
                }
              })
            }
          );

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (candidate && candidate.trim().length > 0) {
              return NextResponse.json({
                success: true,
                data: {
                  reply: cleanLatexArtifacts(candidate.trim()),
                  context: safeContext
                }
              });
            }
          }
        } catch {
          // Try next model or fallback
        }
      }
    }

    // 3. Fallback to built-in portable RainSense reasoning engine
    const localReply = generateRainSenseReply(message, safeContext, cleanedHistory);
    return NextResponse.json({
      success: true,
      data: {
        reply: cleanLatexArtifacts(localReply),
        context: safeContext
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi server xử lý AI' },
      { status: 500 }
    );
  }
}
