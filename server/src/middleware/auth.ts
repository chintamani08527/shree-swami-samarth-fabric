import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config, RoleType } from '../config/index.js';
import { prisma } from '../db/prisma.js';

export interface AuthUser {
  id: string;
  workerId: string;
  name: string;
  role: RoleType;
  departmentId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.auth_token) {
      token = req.cookies.auth_token;
    }

    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
      return;
    }

    const decoded = jwt.verify(token, config.jwtSecret) as { id: string; workerId: string; role: RoleType };
    
    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, workerId: true, name: true, role: true, departmentId: true, isActive: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ success: false, message: 'User account is deactivated or not found.' });
      return;
    }

    req.user = {
      id: user.id,
      workerId: user.workerId,
      name: user.name,
      role: user.role as RoleType,
      departmentId: user.departmentId,
    };

    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
  }
}
