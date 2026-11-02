import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { loginUser, getCurrentUserProfile } from '../services/auth.service.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const loginSchema = z.object({
  body: z.object({
    workerId: z.string().min(1, 'Worker ID is required'),
    password: z.string().min(1, 'Password / PIN is required'),
  }),
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { workerId, password } = req.body;
    const result = await loginUser(workerId, password);

    // Set secure cookie
    res.cookie('auth_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: error.message || 'Authentication failed',
    });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('auth_token');
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const profile = await getCurrentUserProfile(req.user!.id);
    res.json({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message || 'User profile not found',
    });
  }
});

export default router;
