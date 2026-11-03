'use client';
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDateTimeVi } from '@/lib/utils';

const inputTime = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
export function RainDataAudit({ deviceId }: { deviceId: string }) {
  const cache = useQueryClient();
  const [from, setFrom] = useState(() => inputTime(new Date(Date.now() - 15 * 60000)));
  const [to, setTo] = useState(() => inputTime(new Date()));
  const [window, setWindow] = useState<{ from: string; to: string }>();
  const [note, setNote] = useState('Thử nước thủ công');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const { data, error } = useQuery({ queryKey: ['rainAudit', deviceId, window], queryFn: () => api.getRainAudit(deviceId, window?.from, window?.to), refetchInterval: 10000 });
  const run = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true); setMessage('');
    try { await work(); setMessage(success); await cache.invalidateQueries(); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Chưa thực hiện được'); }
    finally { setBusy(false); }
  };
  const period = () => ({ from: new Date(from).toISOString(), to: new Date(to).toISOString(), note });
  const events = data?.events ?? [];
  const active = (data?.periods ?? []).filter((p: any) => Date.parse(p.from) <= Date.now() && Date.parse(p.to) > Date.now());
  const inputClass = 'rounded-lg border border-border bg-background px-3 py-2 text-sm min-w-0';
  return <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
    <h2 className="text-lg font-bold">Đối chiếu nhịp gầu và nước thử</h2>
    <p className="text-sm text-muted-foreground">Tổng ngày và biểu đồ loại các khoảng đã đánh dấu thử nước. Dữ liệu gốc được giữ nguyên. Phần chưa đánh dấu vẫn chưa được xác minh là mưa tự nhiên.</p>
    {active.map((p: any) => <div key={p.id} className="rounded-lg p-3 bg-amber-500/15 text-sm">
      Đang thử nước — tự kết thúc lúc {formatDateTimeVi(p.to)}. {p.note}
      {token && <button className="ml-3 underline" disabled={busy} onClick={() => run(() => api.stopRainTest(deviceId, token, p.id), 'Đã kết thúc phiên thử.')}>Kết thúc thử</button>}
    </div>)}
    <div className="flex flex-wrap gap-2 items-end">
      <label className="text-xs flex flex-col gap-1">Từ<input aria-label="Giờ bắt đầu" className={inputClass} type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <label className="text-xs flex flex-col gap-1">Đến<input aria-label="Giờ kết thúc" className={inputClass} type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      <button className={inputClass} disabled={busy || !from || !to} onClick={() => { try { const p = period(); setWindow({ from: p.from, to: p.to }); } catch { setMessage('Giờ chưa hợp lệ'); } }}>Xem khoảng này</button>
      <button className={inputClass} onClick={() => setWindow(undefined)}>24 giờ gần nhất</button>
    </div>
    <p className="text-xs text-muted-foreground">Ô nhập theo giờ trên thiết bị của bạn. Mốc trong bảng hiển thị theo giờ Việt Nam. Nhịp suy ra từ bộ đếm chỉ biết khoảng giữa hai bản tin, không có giờ chính xác cho từng nhịp.</p>
    <details className="border border-border rounded-lg p-3 space-y-3">
      <summary className="cursor-pointer font-semibold text-sm">Đánh dấu thử nước (quản trị)</summary>
      {!token ? <form className="flex flex-wrap gap-2 pt-3" onSubmit={(e) => { e.preventDefault(); run(async () => { const result = await api.login(email, password); setToken(result.token); setPassword(''); }, 'Đã đăng nhập quản trị cho phiên này.'); }}>
        <input className={inputClass} type="email" autoComplete="username" placeholder="Email quản trị" aria-label="Email quản trị" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={inputClass} type="password" autoComplete="current-password" placeholder="Mật khẩu" aria-label="Mật khẩu" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className={inputClass} disabled={busy}>Đăng nhập</button>
      </form> : <div className="flex flex-wrap gap-2 pt-3">
        <input className={inputClass} aria-label="Ghi chú thử nước" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        <button className={inputClass} disabled={busy || !note.trim()} onClick={() => run(() => api.markRainTest(deviceId, token, period()), 'Đã đánh dấu khoảng thử; tổng ngày và báo cáo đã loại nước thử.')}>Đánh dấu khoảng đã chọn</button>
        <button className={inputClass} disabled={busy || !note.trim() || active.length > 0} onClick={() => run(() => api.markRainTest(deviceId, token, { from: new Date().toISOString(), to: new Date(Date.now() + 3600000).toISOString(), note }), 'Đã bật thử nước trong tối đa 1 giờ; nhấn kết thúc khi xong.')}>Bắt đầu thử 1 giờ</button>
        <button className={inputClass} disabled={busy} onClick={() => run(() => api.markAllRecordedAsTest(deviceId, token), 'Đã đánh dấu toàn bộ lịch sử đến thời điểm chốt là thử nước, giữ nguyên bản ghi gốc.')}>Toàn bộ đã ghi là thử nước</button>
        <button className={inputClass} disabled={busy} onClick={() => setToken('')}>Đăng xuất</button>
      </div>}
      <p className="text-xs text-muted-foreground pt-2">Dùng khoảng đã chọn để đánh dấu lần xả nước trước đây. Nếu một lô nhịp chồng lên khoảng thử, cả lô được tách ra vì chưa biết giờ từng nhịp.</p>
    </details>
    {message && <p role="status" className="text-sm">{message}</p>}
    {error && <p role="alert" className="text-sm text-amber-500">{error.message}</p>}
    {data?.source !== 'postgresql' && data && <p className="text-xs text-amber-500">Đang dùng bộ nhớ dự phòng; bản ghi và nhãn thử có thể mất khi máy chủ khởi động lại.</p>}
    <div className="overflow-auto max-h-96">
      <table className="w-full text-xs text-left"><thead><tr><th className="p-2">Mốc ghi nhận</th><th className="p-2">Nhịp / mm</th><th className="p-2">Thời điểm thực</th><th className="p-2">Phân loại</th></tr></thead>
        <tbody>{events.slice(-100).reverse().map((e: any) => <tr key={e.id} className="border-t border-border">
          <td className="p-2 whitespace-nowrap">{formatDateTimeVi(e.timestamp)}</td>
          <td className="p-2 whitespace-nowrap">{e.tipCount} / {e.rainfallMm.toFixed(2)}</td>
          <td className="p-2">{e.timingQuality === 'device_tip' ? 'Giờ nhịp từ thiết bị' : e.intervalFrom ? `Trong khoảng ${formatDateTimeVi(e.intervalFrom)} → mốc ghi nhận; chưa biết giờ từng nhịp` : 'Dữ liệu cũ / chưa biết giờ từng nhịp'}</td>
          <td className="p-2">{e.dataKind === 'test' ? `Nước thử: ${e.testNote}` : 'Chưa xác minh mưa tự nhiên'}</td>
        </tr>)}</tbody></table>
    </div>
    <p className="text-xs text-muted-foreground">{events.length ? `Hiển thị ${Math.min(100, events.length)} sự kiện gần nhất trong khoảng.` : 'Chưa có sự kiện trong khoảng; chưa đủ để kết luận không mưa.'}{data?.truncated ? ' Truy vấn chạm giới hạn 2.000 sự kiện.' : ''}</p>
  </section>;
}
