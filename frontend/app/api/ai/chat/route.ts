import { NextResponse } from 'next/server';
import { getAiBackendBase } from '@/lib/ai-context.server';
import { cleanChatHistory } from '@/lib/rainsense-ai';
import { chatRequestSchema } from '@/shared/ai-request';

export const maxDuration = 60;

/** The backend owns retrieval, calculation and model credentials. */
export async function POST(req: Request) {
  let input: unknown;
  try { input = await req.json(); }
  catch { return NextResponse.json({ success: false, error: 'Nội dung JSON không hợp lệ' }, { status: 400 }); }
  const body = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const parsed = chatRequestSchema.safeParse({ ...body, deviceId: body.deviceId ?? process.env.NEXT_PUBLIC_DEFAULT_DEVICE_ID ?? 'RS-ESP32S3-01' });
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Câu hỏi phải có 1–4000 ký tự và mã trạm hợp lệ' }, { status: 400 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);
  try {
    const response = await fetch(`${getAiBackendBase()}/api/ai/chat`, {
      method: 'POST', cache: 'no-store', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...parsed.data, history: cleanChatHistory(parsed.data.history) })
    });
    if (!response.ok) {
      const status = response.status === 400 || response.status === 429 ? response.status : 503;
      return NextResponse.json({ success: false, error: status === 429 ? 'Bạn gửi nhiều câu hỏi liên tiếp. Vui lòng thử lại sau.' : 'Chưa kết nối được dịch vụ RainSense AI' },
        { status, headers: response.headers.has('retry-after') ? { 'Retry-After': response.headers.get('retry-after')! } : {} });
    }
    const data = await response.json();
    if (data.success !== true || typeof data.data?.reply !== 'string' || data.data?.context?.deviceId !== parsed.data.deviceId) throw new Error('Invalid backend response');
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: false, error: 'Dịch vụ RainSense AI tạm thời không khả dụng' }, { status: 503 });
  } finally { clearTimeout(timer); }
}
