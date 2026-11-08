import { foldText } from './project-knowledge';

export function wantsDetailedAnswer(query: string): boolean {
  const q = foldText(query);
  if (/ngan gon|tom tat|ngan thoi|dung trong tam/.test(q)) return false;
  return /chi tiet|chuyen sau|tung buoc|giai thich ky|day du|phan tich sau/.test(q);
}

export function answerInstruction(query: string): string {
  return wantsDetailedAnswer(query)
    ? 'Người dùng yêu cầu giải thích chi tiết: giải quyết đúng các ý được hỏi, dùng tối đa 5 mục và khoảng 200–350 từ; mở đầu bằng kết luận, sau đó giải thích cơ chế và cách kiểm tra. Không thêm chủ đề ngoài câu hỏi.'
    : 'Trả lời ngắn, đúng trọng tâm: kết quả/số liệu ở câu đầu, rồi mức độ, nguy cơ có điều kiện và một hành động nếu cần; 3–5 câu, thường 60–130 từ. Câu đơn giản dùng ít hơn. Phân tích phần dữ liệu đang có, không đợi toàn khoảng hoặc đủ mọi cảm biến. Chỉ nêu thông số được hỏi và một giới hạn thực sự ảnh hưởng kết luận. Không mở đầu bằng cảnh báo hoặc lặp nước thử 0 mm.';
}
