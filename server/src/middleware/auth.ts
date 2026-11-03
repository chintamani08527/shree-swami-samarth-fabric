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

interface CachedAuthUser {
  user: {
    id: string;
    workerId: string;
    name: string;
    role: RoleType;
    departmentId: string | null;
    isActive: boolean;
  };
  expiresAt: number;
}

const authCache = new Map<string, CachedAuthUser>();
const AUTH_CACHE_TTL_MS = 30000; // 30 seconds

export function invalidateAuthCache(userId?: string) {
  if (userId) {
    authCache.delete(userId);
  } else {
    authCache.clear();
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
    
    // Check in-memory cache first to avoid redundant DB roundtrips
    const now = Date.now();
    let cached = authCache.get(decoded.id);

    if (!cached || now > cached.expiresAt) {
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, workerId: true, name: true, role: true, departmentId: true, isActive: true },
      });

      if (!dbUser) {
        authCache.delete(decoded.id);
        res.status(401).json({ success: false, message: 'Worker account not found. Please log in again.' });
        return;
      }

      cached = {
        user: {
          id: dbUser.id,
          workerId: dbUser.workerId,
          name: dbUser.name,
          role: dbUser.role as RoleType,
          departmentId: dbUser.departmentId,
          isActive: dbUser.isActive,
        },
        expiresAt: now + AUTH_CACHE_TTL_MS,
      };
      authCache.set(decoded.id, cached);
    }

    if (!cached.user.isActive) {
      res.status(403).json({ success: false, message: 'This worker account has been deactivated by administrator.' });
      return;
    }

    req.user = {
      id: cached.user.id,
      workerId: cached.user.workerId,
      name: cached.user.name,
      role: cached.user.role,
      departmentId: cached.user.departmentId,
    };

    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
  }
}
