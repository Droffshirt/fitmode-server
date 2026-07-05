import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { MuscleGroup, Equipment } from '@prisma/client';

export const listExercises = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { muscle, equipment } = req.query;

    const where: any = {};

    if (muscle) {
      where.muscleGroup = muscle as MuscleGroup;
    }

    if (equipment) {
      where.equipment = equipment as Equipment;
    }

    const exercises = await prisma.exercise.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.status(200).json(
      ApiResponse.success({ exercises }, 'Exercises retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

export const getExerciseDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;

    const exercise = await prisma.exercise.findUnique({
      where: { id },
    });

    if (!exercise) {
      res.status(404).json(ApiResponse.error('Exercise not found'));
      return;
    }

    res.status(200).json(
      ApiResponse.success({ exercise }, 'Exercise details retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};
