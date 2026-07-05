import { Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { generateWorkoutPlan } from '../../engine/workout-generator.js';

export const saveOnboarding = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const { gender, age, weight, height, goal, experienceLevel, equipment, trainingDays, injuries } = req.body;

    // 1. Update user profile details
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        gender,
        age,
        weight,
        height,
        goal,
        experienceLevel,
        equipment,
        trainingDays,
        injuries: injuries ? JSON.stringify(injuries) : '[]',
        onboardingComplete: true,
      },
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
        onboardingComplete: true,
      },
    });

    // 2. Automatically generate their initial 8-week workout program
    const activeProgram = await generateWorkoutPlan({
      userId,
      gender: user.gender!,
      goal: user.goal!,
      experienceLevel: user.experienceLevel!,
      equipment: user.equipment!,
      trainingDays: user.trainingDays!,
      injuries: injuries || [],
    });

    res.status(200).json(
      ApiResponse.success(
        { user, activeProgram },
        'Onboarding completed and workout program generated successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const { name, gender, age, weight, height, trainingDays } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(gender && { gender }),
        ...(age && { age }),
        ...(weight && { weight }),
        ...(height && { height }),
        ...(trainingDays && { trainingDays }),
      },
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
        onboardingComplete: true,
      },
    });

    res.status(200).json(
      ApiResponse.success({ user }, 'Profile updated successfully')
    );
  } catch (error) {
    next(error);
  }
};
