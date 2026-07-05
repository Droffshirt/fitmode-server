import { Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';

export const logProgress = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const { bodyWeight, waistMeasurement, hipMeasurement, notes, photoUrl, energyLevel } = req.body;

    if (!bodyWeight && !waistMeasurement && !hipMeasurement) {
      throw ApiError.badRequest('At least one progress metric (weight, waist, hip) must be provided.');
    }

    const metric = await prisma.progressMetric.create({
      data: {
        userId,
        bodyWeight,
        waistMeasurement,
        hipMeasurement,
        notes,
        photoUrl,
        energyLevel,
      }
    });

    // Sync weight back to User profile if logged
    if (bodyWeight) {
      await prisma.user.update({
        where: { id: userId },
        data: { weight: bodyWeight }
      });
    }

    res.status(201).json(
      ApiResponse.created({ metric }, 'Progress metrics logged successfully')
    );
  } catch (error) {
    next(error);
  }
};

export const getProgressLogs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;

    const logs = await prisma.progressMetric.findMany({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
      take: 100
    });

    res.status(200).json(
      ApiResponse.success({ logs }, 'Progress logs retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

export const getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;

    const logs = await prisma.progressMetric.findMany({
      where: { userId },
      orderBy: { recordedAt: 'asc' }
    });

    // 1. Calculate weight change
    let weightChange = 0;
    let latestWeight = null;
    let initialWeight = null;

    if (logs.length > 0) {
      const logsWithWeight = logs.filter(l => l.bodyWeight !== null);
      if (logsWithWeight.length > 0) {
        initialWeight = logsWithWeight[0].bodyWeight;
        latestWeight = logsWithWeight[logsWithWeight.length - 1].bodyWeight;
        weightChange = latestWeight! - initialWeight!;
      }
    }

    // 2. Calculate waist change
    let waistChange = 0;
    let latestWaist = null;
    let initialWaist = null;

    if (logs.length > 0) {
      const logsWithWaist = logs.filter(l => l.waistMeasurement !== null);
      if (logsWithWaist.length > 0) {
        initialWaist = logsWithWaist[0].waistMeasurement;
        latestWaist = logsWithWaist[logsWithWaist.length - 1].waistMeasurement;
        waistChange = latestWaist! - initialWaist!;
      }
    }

    // 3. Calculate Adherence & Streaks
    // Count distinct active exercise log days to compute workout streak
    const completedSets = await prisma.exerciseLog.findMany({
      where: { userId, completed: true },
      select: { loggedAt: true },
      orderBy: { loggedAt: 'desc' }
    });

    // Extract unique dates
    const uniqueDates = Array.from(new Set(
      completedSets.map(s => s.loggedAt.toISOString().split('T')[0])
    ));

    // Calculate streak
    let streak = 0;
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // User is active if they worked out today or yesterday
    let isStreakActive = uniqueDates.includes(todayStr) || uniqueDates.includes(yesterdayStr);

    if (isStreakActive && uniqueDates.length > 0) {
      let currentCheck = new Date();
      if (!uniqueDates.includes(todayStr) && uniqueDates.includes(yesterdayStr)) {
        currentCheck = yesterday;
      }
      
      while (true) {
        const checkStr = currentCheck.toISOString().split('T')[0];
        if (uniqueDates.includes(checkStr)) {
          streak++;
          currentCheck.setDate(currentCheck.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Adherence score (work outs completed in last 7 days vs plan recommendation)
    const last7DaysCount = uniqueDates.filter(d => {
      const workoutDate = new Date(d);
      const diffTime = Math.abs(new Date().getTime() - workoutDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    }).length;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { trainingDays: true }
    });

    const targetDays = user?.trainingDays || 3;
    const complianceRate = Math.min(100, Math.round((last7DaysCount / targetDays) * 100));

    res.status(200).json(
      ApiResponse.success({
        weight: {
          initial: initialWeight,
          current: latestWeight,
          change: weightChange,
        },
        waist: {
          initial: initialWaist,
          current: latestWaist,
          change: waistChange,
        },
        streak,
        complianceRate,
        historyLogsCount: logs.length,
      }, 'Analytics computed successfully')
    );
  } catch (error) {
    next(error);
  }
};
