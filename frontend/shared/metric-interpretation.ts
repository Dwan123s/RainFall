import { calculateDewPoint } from './utils/weather-calc';

/** Descriptive project bands, not medical thresholds or proof of sunshine/rain. */
export function temperatureFeeling(t: number, rh: number | null = null): string {
  const dew = rh !== null && rh > 0 ? calculateDewPoint(t, rh) : null;
  if (t >= 32) return dew !== null && dew >= 21 ? 'khá nóng và oi ẩm' : 'khá nóng';
  if (t < 18) return 'khá mát, có thể cảm thấy lạnh';
  if (dew !== null && dew >= 21) return 'ấm và khá ẩm';
  if (t <= 24) return 'khá mát';
  if (t <= 30) return rh === null ? 'ấm' : rh < 35 ? 'khá khô' : 'ấm và khá dễ chịu';
  return 'ấm đến khá nóng';
}

export function humidityFeeling(rh: number): string {
  return rh < 35 ? 'độ ẩm tương đối thấp, không khí khá khô' : rh < 70 ? 'độ ẩm tương đối ở mức vừa theo cách diễn giải của trạm' : rh < 85 ? 'độ ẩm tương đối khá cao' : 'độ ẩm tương đối cao, không khí gần bão hòa hơn';
}

export function temperatureInterpretation(t: number, rh: number | null = null): string {
  return `Có thể nhận xét ${temperatureFeeling(t, rh)}; cảm giác còn tùy độ ẩm, gió và bức xạ, chưa cho biết hôm nay nắng hay mưa.`;
}

export function humidityInterpretation(rh: number): string {
  const feeling = humidityFeeling(rh);
  return `${feeling.charAt(0).toUpperCase()}${feeling.slice(1)}; RH phụ thuộc nhiệt độ, không phải độ ẩm đất và riêng giá trị này chưa xác định sắp mưa.`;
}

export function pressureInterpretation(delta3h: number | null = null): string {
  return delta3h === null
    ? 'Đây là khí áp tại trạm; cần so với cùng độ cao/loại số đo và các mốc khác để biết cao–thấp hay tăng–giảm, không dùng riêng số này để kết luận trời đẹp hoặc có bão.'
    : `Khí áp đổi ${delta3h > 0 ? '+' : ''}${delta3h} hPa trong 3 giờ đã đo; đây là yếu tố bổ trợ diễn biến thời tiết, chưa xác nhận bão hay giờ mưa.`;
}
