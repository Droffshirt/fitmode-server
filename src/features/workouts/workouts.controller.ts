import { Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { generateWorkoutPlan } from '../../engine/workout-generator.js';
import { calculateProgressionForWeek } from '../../engine/progression.js';

export const generatePlan = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const { goal, experienceLevel, equipment, trainingDays, injuries } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const newPlan = await generateWorkoutPlan({
      userId,
      gender: user.gender || 'FEMALE',
      goal,
      experienceLevel,
      equipment,
      trainingDays,
      injuries: injuries || [],
    });

    res.status(201).json(
      ApiResponse.created({ activeProgram: newPlan }, 'New workout plan generated successfully')
    );
  } catch (error) {
    next(error);
  }
};

export const getActivePlan = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;

    const activePlan = await prisma.workoutPlan.findFirst({
      where: { userId, isActive: true },
      include: {
        workoutDays: {
          include: {
            workoutExercises: {
              include: {
                exercise: true,
                exerciseLogs: {
                  where: { userId }
                }
              },
              orderBy: { orderIndex: 'asc' }
            }
          },
          orderBy: { dayNumber: 'asc' }
        }
      }
    });

    if (!activePlan) {
      res.status(200).json(ApiResponse.success({ activePlan: null }, 'No active workout plan found'));
      return;
    }

    // Fetch full Exercise details for all alternative IDs in one batch
    const allAltIds = new Set<string>();
    activePlan.workoutDays.forEach(day => {
      day.workoutExercises.forEach(we => {
        if (we.alternatives) {
          try {
            const ids: string[] = JSON.parse(we.alternatives);
            ids.forEach(id => allAltIds.add(id));
          } catch (e) {}
        }
      });
    });

    const altExercises = await prisma.exercise.findMany({
      where: { id: { in: Array.from(allAltIds) } }
    });

    // Apply progression engine dynamic values based on activePlan.currentWeek
    const week = activePlan.currentWeek;
    
    const progressedDays = activePlan.workoutDays.map(day => {
      const progressedExercises = day.workoutExercises.map(we => {
        const progression = calculateProgressionForWeek(
          week,
          we.sets,
          we.targetReps,
          we.restSeconds
        );

        let fullAlternatives: any[] = [];
        if (we.alternatives) {
          try {
            const altIds: string[] = JSON.parse(we.alternatives);
            fullAlternatives = altIds
              .map(id => altExercises.find(ex => ex.id === id))
              .filter(Boolean);
          } catch (e) {}
        }

        return {
          ...we,
          dynamicSets: progression.sets,
          dynamicReps: progression.reps,
          dynamicRestSeconds: progression.restSeconds,
          dynamicIntensityDesc: progression.intensityDesc,
          dynamicNotes: progression.notes,
          weightMultiplier: progression.weightMultiplier,
          alternativesList: fullAlternatives,
        };
      });

      return {
        ...day,
        workoutExercises: progressedExercises
      };
    });

    const progressedPlan = {
      ...activePlan,
      workoutDays: progressedDays
    };

    res.status(200).json(
      ApiResponse.success({ activePlan: progressedPlan }, 'Active plan retrieved successfully with dynamic progression values')
    );
  } catch (error) {
    next(error);
  }
};

export const logSet = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const { workoutExerciseId, setNumber, weightUsed, repsCompleted, rir, completed, notes } = req.body;

    const log = await prisma.exerciseLog.upsert({
      where: {
        // Since logs don't have a unique composite index in schema, we look for an existing log for this user, workoutExercise, and set
        id: await prisma.exerciseLog.findFirst({
          where: { userId, workoutExerciseId, setNumber }
        }).then(l => l?.id || 'non-existent-id')
      },
      create: {
        userId,
        workoutExerciseId,
        setNumber,
        weightUsed,
        repsCompleted,
        rir,
        completed: completed ?? true,
        notes,
      },
      update: {
        weightUsed,
        repsCompleted,
        rir,
        completed: completed ?? true,
        notes,
        loggedAt: new Date(),
      }
    });

    res.status(200).json(
      ApiResponse.success({ log }, 'Set logged successfully')
    );
  } catch (error) {
    next(error);
  }
};

export const completeDay = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const { workoutDayId } = req.body;

    // Fetch all exercises for this day to mark logs complete
    const day = await prisma.workoutDay.findUnique({
      where: { id: workoutDayId },
      include: { workoutExercises: true }
    });

    if (!day) {
      throw ApiError.notFound('Workout day not found');
    }

    // Check all logs of the day's exercises
    const exerciseIds = day.workoutExercises.map(we => we.id);

    // Fetch current logs for these exercises
    const currentLogs = await prisma.exerciseLog.findMany({
      where: {
        userId,
        workoutExerciseId: { in: exerciseIds }
      }
    });

    // Mark any incomplete logged sets for this day as completed
    await prisma.exerciseLog.updateMany({
      where: {
        userId,
        workoutExerciseId: { in: exerciseIds }
      },
      data: { completed: true }
    });

    // Simple Auto-Progression Check
    // If the user did exceptionally well (completed all target reps at low RIR),
    // we can save a recommendation or automatically progress their active plan week
    const activePlan = await prisma.workoutPlan.findFirst({
      where: { userId, isActive: true }
    });

    if (activePlan) {
      // Check if all workout days in this week have been completed
      // For MVP, completing a day just adds to their streak. We increment currentWeek every 3-4 sessions completed
      const totalCompletedDays = await prisma.exerciseLog.findMany({
        where: { userId, completed: true },
        distinct: ['workoutExerciseId']
      });

      // Let's increment week if they completed enough exercises (e.g., after 4 workouts, go to next week, capped at 8)
      const logsCount = await prisma.exerciseLog.count({
        where: { userId, completed: true }
      });

      // Simple heuristic: after every 15 exercises completed, we can increment their week (or let them manually trigger)
      if (logsCount > 0 && logsCount % 15 === 0 && activePlan.currentWeek < 8) {
        await prisma.workoutPlan.update({
          where: { id: activePlan.id },
          data: { currentWeek: activePlan.currentWeek + 1 }
        });
      }
    }

    res.status(200).json(
      ApiResponse.success(null, 'Workout day completed successfully! High five! 🔥')
    );
  } catch (error) {
    next(error);
  }
};

export const getWorkoutHistory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;

    const history = await prisma.exerciseLog.findMany({
      where: { userId },
      include: {
        workoutExercise: {
          include: {
            exercise: true,
            workoutDay: {
              include: {
                workoutPlan: true
              }
            }
          }
        }
      },
      orderBy: { loggedAt: 'desc' },
      take: 50,
    });

    res.status(200).json(
      ApiResponse.success({ history }, 'Workout history retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /workouts/workout-exercise/:workoutExerciseId/alternatives
 * Returns ranked compatible alternatives for a slot
 */
export const getWorkoutExerciseAlternatives = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { workoutExerciseId } = req.params;
    if (typeof workoutExerciseId !== 'string') {
      throw ApiError.badRequest('Invalid workout exercise ID');
    }

    const we = await prisma.workoutExercise.findUnique({
      where: { id: workoutExerciseId }
    });

    if (!we) {
      throw ApiError.notFound('Workout exercise not found');
    }

    const altIds: string[] = we.alternatives ? JSON.parse(we.alternatives) : [];
    const alternatives = await prisma.exercise.findMany({
      where: { id: { in: altIds } }
    });

    // Keep the ranked order
    const sortedAlternatives = altIds
      .map(id => alternatives.find(a => a.id === id))
      .filter(Boolean);

    res.status(200).json(
      ApiResponse.success({ alternatives: sortedAlternatives }, 'Ranked alternatives retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /workouts/swap-exercise
 * Swap current exercise with a compatible alternative and save user preference.
 */
export const swapExercise = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const { workoutExerciseId, newExerciseId } = req.body;

    const we = await prisma.workoutExercise.findUnique({
      where: { id: workoutExerciseId },
      include: {
        workoutDay: {
          include: { workoutPlan: true }
        }
      }
    });

    if (!we) {
      throw ApiError.notFound('Workout exercise not found');
    }

    // Verify the new exercise exists
    const newEx = await prisma.exercise.findUnique({
      where: { id: newExerciseId }
    });

    if (!newEx) {
      throw ApiError.notFound('Alternative exercise not found');
    }

    // Update WorkoutExercise
    const updated = await prisma.workoutExercise.update({
      where: { id: workoutExerciseId },
      data: { exerciseId: newExerciseId },
      include: { exercise: true }
    });

    // Save preference to UserExercisePreference
    if (we.slot) {
      const slotKey = `${we.workoutDay.workoutPlan.programType}_d${we.workoutDay.dayNumber}_${we.slot}`;
      await prisma.userExercisePreference.upsert({
        where: {
          userId_slotKey: {
            userId,
            slotKey
          }
        },
        create: {
          userId,
          slotKey,
          exerciseId: newExerciseId,
          usedCount: 1,
          lastUsedAt: new Date()
        },
        update: {
          exerciseId: newExerciseId,
          usedCount: { increment: 1 },
          lastUsedAt: new Date()
        }
      });
    }

    res.status(200).json(
      ApiResponse.success({ updatedExercise: updated.exercise }, 'Exercise swapped successfully and preference saved')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /workouts/repeat-last-week
 * Restores exercise preferences from previously saved UserExercisePreferences for the day.
 */
export const repeatLastWeek = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const { workoutDayId } = req.body;

    const day = await prisma.workoutDay.findUnique({
      where: { id: workoutDayId },
      include: {
        workoutPlan: true,
        workoutExercises: true
      }
    });

    if (!day) {
      throw ApiError.notFound('Workout day not found');
    }

    const programType = day.workoutPlan.programType;
    const dayNumber = day.dayNumber;

    // Fetch user preferences
    const preferences = await prisma.userExercisePreference.findMany({
      where: { userId }
    });

    let updatedCount = 0;
    for (const we of day.workoutExercises) {
      if (!we.slot) continue;
      const slotKey = `${programType}_d${dayNumber}_${we.slot}`;
      const pref = preferences.find(p => p.slotKey === slotKey);

      if (pref && pref.exerciseId !== we.exerciseId) {
        await prisma.workoutExercise.update({
          where: { id: we.id },
          data: { exerciseId: pref.exerciseId }
        });
        updatedCount++;
      }
    }

    res.status(200).json(
      ApiResponse.success({ updatedCount }, `Restored ${updatedCount} exercises from your preferences`)
    );
  } catch (error) {
    next(error);
  }
};
