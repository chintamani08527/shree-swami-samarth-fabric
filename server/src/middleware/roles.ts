import { Request, Response, NextFunction } from 'express';
import { RoleType, Roles } from '../config/index.js';

export function authorize(...allowedRoles: RoleType[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to perform this action.',
      });
      return;
    }

    next();
  };
}

export const requireAdmin = authorize(Roles.SUPER_ADMIN, Roles.ADMIN);
export const requireSuperAdmin = authorize(Roles.SUPER_ADMIN);
export const requireSupervisorOrAdmin = authorize(Roles.SUPER_ADMIN, Roles.ADMIN, Roles.SUPERVISOR);
