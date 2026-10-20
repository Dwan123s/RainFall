import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { dataStore } from '../db/store';
import { generateToken, AuthRequest } from '../middleware/auth.middleware';

export const authController = {
  async login(req: Request, res: Response) {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Vui lòng cung cấp email và mật khẩu' });
    }

    const user = await dataStore.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Email hoặc mật khẩu không chính xác' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Email hoặc mật khẩu không chính xác' });
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      }
    });
  },

  async me(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
    }
    const user = await dataStore.getUserByEmail(req.user.email);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Người dùng không tồn tại' });
    }
    return res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  }
};
