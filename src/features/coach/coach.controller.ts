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

    // Verify coach has access to this client
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

    // Verify coach relationship
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
    let activeStreaksSum = 0;
    let compliantCount = 0;

    // Calculate generic compliance for all clients
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
      
      if (compliance >= 60) {
        compliantCount++;
      }
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
