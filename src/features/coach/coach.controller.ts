import { Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { generateWorkoutPlan } from '../../engine/workout-generator.js';

export const addClient = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const coachId = req.userId!;
    const { clientEmail } = req.body;

    const client = await prisma.user.findUnique({
      where: { email: clientEmail }
    });

    if (!client) {
      throw ApiError.notFound('No user found with this email address');
    }

    if (client.role !== 'USER') {
      throw ApiError.badRequest('Only standard users can be added as clients');
    }

    const existingRelationship = await prisma.coachClient.findUnique({
      where: {
        coachId_clientId: { coachId, clientId: client.id }
      }
    });

    if (existingRelationship) {
      throw ApiError.conflict('This client is already in your client roster');
    }

    const relationship = await prisma.coachClient.create({
      data: {
        coachId,
        clientId: client.id,
        status: 'active'
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.status(201).json(
      ApiResponse.created({ relationship }, 'Client added successfully to roster')
    );
  } catch (error) {
    next(error);
  }
};

export const getClients = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const coachId = req.userId!;

    const relationships = await prisma.coachClient.findMany({
      where: { coachId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            gender: true,
            goal: true,
            experienceLevel: true,
            weight: true,
            height: true,
            onboardingComplete: true,
            workoutPlans: {
              where: { isActive: true },
              select: { name: true, currentWeek: true }
            }
          }
        }
      }
    });

    const clients = relationships.map(r => ({
      relationshipId: r.id,
      status: r.status,
      startedAt: r.startedAt,
      ...r.client,
      activePlan: r.client.workoutPlans[0] || null
    }));

    res.status(200).json(
      ApiResponse.success({ clients }, 'Clients roster retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

export const getClientProgress = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const coachId = req.userId!;
    const clientId = req.params.id as string;

    const relationship = await prisma.coachClient.findFirst({
      where: { coachId, clientId }
    });

    if (!relationship) {
      throw ApiError.forbidden('You do not have authorization to view this user\'s progress');
    }

    const progressMetrics = await prisma.progressMetric.findMany({
      where: { userId: clientId },
      orderBy: { recordedAt: 'desc' },
      take: 50
    });

    const workoutHistory = await prisma.exerciseLog.findMany({
      where: { userId: clientId, completed: true },
      include: {
        workoutExercise: {
          include: {
            exercise: true,
            workoutDay: true
          }
        }
      },
      orderBy: { loggedAt: 'desc' },
      take: 50
    });

    res.status(200).json(
      ApiResponse.success(
        { progressMetrics, workoutHistory },
        'Client detailed progress retrieved successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

export const assignProgram = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const coachId = req.userId!;
    const { clientId, goal, experienceLevel, equipment, trainingDays, injuries } = req.body;

    const relationship = await prisma.coachClient.findFirst({
      where: { coachId, clientId }
    });

    if (!relationship) {
      throw ApiError.forbidden('You are not authorized to assign plans to this user');
    }

    const client = await prisma.user.findUnique({
      where: { id: clientId }
    });

    if (!client) {
      throw ApiError.notFound('Client user not found');
    }

    const activeProgram = await generateWorkoutPlan({
      userId: clientId,
      gender: client.gender || 'FEMALE',
      goal,
      experienceLevel,
      equipment,
      trainingDays,
      injuries: injuries || [],
    });

    res.status(200).json(
      ApiResponse.success({ activeProgram }, 'Custom program generated and assigned to client successfully')
    );
  } catch (error) {
    next(error);
  }
};

export const getCoachAnalytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const coachId = req.userId!;

    const relationships = await prisma.coachClient.findMany({
      where: { coachId },
      include: {
        client: {
          select: {
            id: true,
            exerciseLogs: {
              where: { completed: true },
              select: { loggedAt: true }
            },
            trainingDays: true
          }
        }
      }
    });

    const totalClients = relationships.length;
    let compliantCount = 0;

    for (const r of relationships) {
      const logs = r.client.exerciseLogs;
      const uniqueDates = Array.from(new Set(
        logs.map(l => l.loggedAt.toISOString().split('T')[0])
      ));

      const last7DaysCount = uniqueDates.filter(d => {
        const workoutDate = new Date(d);
        const diffTime = Math.abs(new Date().getTime() - workoutDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }).length;

      const target = r.client.trainingDays || 3;
      const compliance = Math.round((last7DaysCount / target) * 100);
      if (compliance >= 60) compliantCount++;
    }

    const overallCompliance = totalClients > 0 ? Math.round((compliantCount / totalClients) * 100) : 100;

    res.status(200).json(
      ApiResponse.success({
        totalClients,
        overallCompliance,
        compliantClients: compliantCount,
        needsAttention: totalClients - compliantCount,
      }, 'Coach analytics retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

// ─── Exercise Management ────────────────────────────────────────────────────

/** GET /coach/exercises — List all exercises */
export const listAllExercises = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const exercises = await prisma.exercise.findMany({ orderBy: { name: 'asc' } });
    res.status(200).json(ApiResponse.success({ exercises }, 'All exercises retrieved'));
  } catch (error) {
    next(error);
  }
};

/** POST /coach/exercises — Create a new exercise */
export const createExercise = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      name, muscleGroup, secondaryMuscles = [], equipment, difficulty,
      movementPattern, isCompound = false, contraindications = [],
      coachingCues = [], demoUrl,
    } = req.body;

    const exercise = await prisma.exercise.create({
      data: {
        name, muscleGroup, equipment, difficulty, movementPattern, isCompound,
        secondaryMuscles: JSON.stringify(secondaryMuscles),
        contraindications: JSON.stringify(contraindications),
        coachingCues: JSON.stringify(coachingCues),
        demoUrl: demoUrl || null,
      },
    });
    res.status(201).json(ApiResponse.created({ exercise }, 'Exercise created successfully'));
  } catch (error: any) {
    if (error?.code === 'P2002') {
      next(ApiError.conflict('An exercise with this name already exists'));
    } else {
      next(error);
    }
  }
};

/** PUT /coach/exercises/:id — Update an exercise */
export const updateExercise = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const {
      name, muscleGroup, secondaryMuscles, equipment, difficulty,
      movementPattern, isCompound, contraindications, coachingCues, demoUrl,
    } = req.body;

    const existing = await prisma.exercise.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Exercise not found');

    const updated = await prisma.exercise.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(muscleGroup !== undefined && { muscleGroup }),
        ...(secondaryMuscles !== undefined && { secondaryMuscles: JSON.stringify(secondaryMuscles) }),
        ...(equipment !== undefined && { equipment }),
        ...(difficulty !== undefined && { difficulty }),
        ...(movementPattern !== undefined && { movementPattern }),
        ...(isCompound !== undefined && { isCompound }),
        ...(contraindications !== undefined && { contraindications: JSON.stringify(contraindications) }),
        ...(coachingCues !== undefined && { coachingCues: JSON.stringify(coachingCues) }),
        ...(demoUrl !== undefined && { demoUrl: demoUrl || null }),
      },
    });
    res.status(200).json(ApiResponse.success({ exercise: updated }, 'Exercise updated successfully'));
  } catch (error) {
    next(error);
  }
};

/** DELETE /coach/exercises/:id — Delete an exercise (only if not in use) */
export const deleteExercise = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.exercise.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Exercise not found');

    const inUseCount = await prisma.workoutExercise.count({ where: { exerciseId: id } });
    if (inUseCount > 0) {
      throw ApiError.badRequest(`Cannot delete: used in ${inUseCount} active workout session(s).`);
    }

    await prisma.exercise.delete({ where: { id } });
    res.status(200).json(ApiResponse.success(null, 'Exercise deleted successfully'));
  } catch (error) {
    next(error);
  }
};

// ─── Workout Plans / Day Notes Management ───────────────────────────────────

/** GET /coach/workouts — All workout plans for coach's clients */
export const getClientWorkoutPlans = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const coachId = req.userId!;
    const relationships = await prisma.coachClient.findMany({
      where: { coachId }, select: { clientId: true }
    });
    const clientIds = relationships.map(r => r.clientId);

    const plans = await prisma.workoutPlan.findMany({
      where: { userId: { in: clientIds } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        workoutDays: {
          include: {
            workoutExercises: { include: { exercise: true }, orderBy: { orderIndex: 'asc' } }
          },
          orderBy: { dayNumber: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(ApiResponse.success({ plans }, 'Client workout plans retrieved'));
  } catch (error) {
    next(error);
  }
};

/** PATCH /coach/workout-days/:id — Update a client's workout day name/focusArea */
export const updateWorkoutDay = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const coachId = req.userId!;
    const id = req.params.id as string;
    const { name, focusArea } = req.body;

    const day = await prisma.workoutDay.findUnique({
      where: { id },
      include: { workoutPlan: { select: { userId: true } } }
    }) as any;
    if (!day) throw ApiError.notFound('Workout day not found');

    const rel = await prisma.coachClient.findFirst({ where: { coachId, clientId: day.workoutPlan.userId } });
    if (!rel) throw ApiError.forbidden('No access to this client\'s workouts');

    const updated = await prisma.workoutDay.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(focusArea !== undefined && { focusArea }),
      },
      include: { workoutExercises: { include: { exercise: true }, orderBy: { orderIndex: 'asc' } } }
    });
    res.status(200).json(ApiResponse.success({ workoutDay: updated }, 'Workout day updated'));
  } catch (error) {
    next(error);
  }
};

/** PATCH /coach/workout-exercises/:id — Update sets/reps/rest/notes on a client's exercise */
export const updateWorkoutExercise = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const coachId = req.userId!;
    const id = req.params.id as string;
    const { sets, targetReps, restSeconds, notes } = req.body;

    const we = await prisma.workoutExercise.findUnique({
      where: { id },
      include: { workoutDay: { include: { workoutPlan: { select: { userId: true } } } } }
    }) as any;
    if (!we) throw ApiError.notFound('Workout exercise not found');

    const rel = await prisma.coachClient.findFirst({
      where: { coachId, clientId: we.workoutDay.workoutPlan.userId }
    });
    if (!rel) throw ApiError.forbidden('No access to this client\'s workouts');

    const updated = await prisma.workoutExercise.update({
      where: { id },
      data: {
        ...(sets !== undefined && { sets }),
        ...(targetReps !== undefined && { targetReps }),
        ...(restSeconds !== undefined && { restSeconds }),
        ...(notes !== undefined && { notes }),
      },
      include: { exercise: true }
    });
    res.status(200).json(ApiResponse.success({ workoutExercise: updated }, 'Exercise prescription updated'));
  } catch (error) {
    next(error);
  }
};

/** POST /coach/exercises/import — Bulk import exercises */
export const bulkImportExercises = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { exercises } = req.body;
    if (!Array.isArray(exercises)) {
      throw ApiError.badRequest('Invalid exercises array');
    }

    const imported = [];
    for (const ex of exercises) {
      if (!ex.name || !ex.muscleGroup || !ex.equipment || !ex.difficulty || !ex.movementPattern) {
        continue;
      }

      const secondaryMuscles = Array.isArray(ex.secondaryMuscles) ? JSON.stringify(ex.secondaryMuscles) : (ex.secondaryMuscles || '[]');
      const contraindications = Array.isArray(ex.contraindications) ? JSON.stringify(ex.contraindications) : (ex.contraindications || '[]');
      const coachingCues = Array.isArray(ex.coachingCues) ? JSON.stringify(ex.coachingCues) : (ex.coachingCues || '[]');

      const result = await prisma.exercise.upsert({
        where: { name: ex.name },
        update: {
          muscleGroup: ex.muscleGroup,
          secondaryMuscles,
          equipment: ex.equipment,
          difficulty: ex.difficulty,
          movementPattern: ex.movementPattern,
          isCompound: !!ex.isCompound,
          contraindications,
          coachingCues,
          demoUrl: ex.demoUrl || null,
        },
        create: {
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          secondaryMuscles,
          equipment: ex.equipment,
          difficulty: ex.difficulty,
          movementPattern: ex.movementPattern,
          isCompound: !!ex.isCompound,
          contraindications,
          coachingCues,
          demoUrl: ex.demoUrl || null,
        }
      });
      imported.push(result);
    }

    res.status(200).json(ApiResponse.success({ count: imported.length }, `${imported.length} exercises imported successfully`));
  } catch (error) {
    next(error);
  }
};

