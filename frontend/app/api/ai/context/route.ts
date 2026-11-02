import { NextResponse } from 'next/server';
import { fetchStationContext } from '@/lib/ai-context.server';
import { deviceIdSchema } from '../../../../../backend/src/shared/ai-request';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const deviceId = new URL(req.url).searchParams.get('deviceId') || 'RS-ESP32S3-01';
  if (!deviceIdSchema.safeParse(deviceId).success) return NextResponse.json({ success: false, error: 'Mã trạm không hợp lệ' }, { status: 400 });
  return NextResponse.json({ success: true, data: await fetchStationContext(deviceId) });
}
