import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { sendResetPasswordEmail } from '../../utils/mailer.js';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, name, role } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw ApiError.conflict('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: role || 'USER',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        onboardingComplete: true,
        createdAt: true,
      },
    });

    const token = jwt.sign({ userId: user.id, role: user.role }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    res.status(201).json(
      ApiResponse.created({ user, token }, 'User registered successfully')
    );
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      onboardingComplete: user.onboardingComplete,
      gender: user.gender,
      goal: user.goal,
      experienceLevel: user.experienceLevel,
      equipment: user.equipment,
      trainingDays: user.trainingDays,
    };

    res.status(200).json(
      ApiResponse.success({ user: userResponse, token }, 'Login successful')
    );
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        gender: true,
        age: true,
        weight: true,
        height: true,
        goal: true,
        experienceLevel: true,
        equipment: true,
        trainingDays: true,
        injuries: true,
        subscriptionType: true,
        onboardingComplete: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    res.status(200).json(
      ApiResponse.success({ user }, 'Current user retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // If user is not found, return success response to prevent email enumeration
    if (!user) {
      res.status(200).json(
        ApiResponse.success(null, 'If an account exists with that email, a password reset link has been sent')
      );
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour from now

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: token,
        resetPasswordExpires: expires,
      },
    });

    await sendResetPasswordEmail(email, token);

    res.status(200).json(
      ApiResponse.success(null, 'If an account exists with that email, a password reset link has been sent')
    );
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, password } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw ApiError.badRequest('Password reset token is invalid or has expired');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    res.status(200).json(
      ApiResponse.success(null, 'Password has been reset successfully')
    );
  } catch (error) {
    next(error);
  }
};

