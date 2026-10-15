import { Request, Response } from 'express';
import { aiService, ChatMessage } from '../services/ai.service';
import { env } from '../config/env';

export const aiController = {
  async chat(req: Request, res: Response) {
    try {
      const { message, history = [], deviceId = env.DEFAULT_STATION_ID } = req.body;

      if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Vui lòng cung cấp nội dung câu hỏi cho Chiikawa AI'
        });
      }

      const result = await aiService.chat(
        message.trim(),
        history as ChatMessage[],
        deviceId
      );

      return res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Lỗi khi xử lý phản hồi từ Chiikawa AI'
      });
    }
  },

  async getContext(req: Request, res: Response) {
    try {
      const deviceId = (req.query.deviceId as string) || env.DEFAULT_STATION_ID;
      const context = await aiService.getLiveContext(deviceId);
      return res.json({
        success: true,
        data: context
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Lỗi khi lấy ngữ cảnh trạm cho Chiikawa AI'
      });
    }
  }
};
