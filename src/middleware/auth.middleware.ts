import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import prisma from '../config/database.js';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

export const authMiddleware = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; role: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(ApiError.unauthorized('Invalid token'));
    }
  }
};

export const coachMiddleware = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  if (req.userRole !== 'COACH' && req.userRole !== 'ADMIN') {
    next(ApiError.forbidden('Coach access required'));
    return;
  }
  next();
};

export const adminMiddleware = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  if (req.userRole !== 'ADMIN') {
    next(ApiError.forbidden('Admin access required'));
    return;
  }
  next();
};
