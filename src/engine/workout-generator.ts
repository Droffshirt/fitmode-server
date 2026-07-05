import { prisma } from '../config/database.js';
import { Goal, Experience, Equipment, MuscleGroup, Difficulty, Prisma } from '@prisma/client';
import { isEquipmentCompatible } from './swap-engine.js';

interface GeneratorOptions {
  userId: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  goal: Goal;
  experienceLevel: Experience;
  equipment: Equipment;
  trainingDays: number;
  injuries: string[]; // e.g. ["LOWER_BACK_PAIN", "KNEE_PAIN", "SHOULDER_IMPINGEMENT"]
}

interface SlotTemplate {
  slot: string;
  muscleGroup: MuscleGroup;
  movementPattern?: string;
  isCompound?: boolean;
}

// Structured Day Templates per program type and day number
const templates: Record<string, Record<number, SlotTemplate[]>> = {
  full_body: {
    1: [
      { slot: 'quad_compound', muscleGroup: MuscleGroup.QUADS, movementPattern: 'squat', isCompound: true },
      { slot: 'chest_compound', muscleGroup: MuscleGroup.CHEST, movementPattern: 'push', isCompound: true },
      { slot: 'back_compound', muscleGroup: MuscleGroup.BACK, movementPattern: 'pull', isCompound: true },
      { slot: 'shoulder_isolation', muscleGroup: MuscleGroup.SHOULDERS, movementPattern: 'isolation', isCompound: false },
      { slot: 'core_isolation', muscleGroup: MuscleGroup.ABS, movementPattern: 'isolation', isCompound: false },
    ],
    2: [
      { slot: 'glute_compound', muscleGroup: MuscleGroup.GLUTES, movementPattern: 'hinge', isCompound: true },
      { slot: 'hamstring_compound', muscleGroup: MuscleGroup.HAMSTRINGS, movementPattern: 'hinge', isCompound: true },
      { slot: 'chest_isolation', muscleGroup: MuscleGroup.CHEST, movementPattern: 'isolation', isCompound: false },
      { slot: 'back_isolation', muscleGroup: MuscleGroup.BACK, movementPattern: 'isolation', isCompound: false },
      { slot: 'bicep_isolation', muscleGroup: MuscleGroup.BICEPS, movementPattern: 'isolation', isCompound: false },
    ],
  },
  glute_specialization: {
    1: [
      { slot: 'glute_compound_primary', muscleGroup: MuscleGroup.GLUTES, movementPattern: 'hinge', isCompound: true },
      { slot: 'glute_compound_secondary', muscleGroup: MuscleGroup.GLUTES, movementPattern: 'squat', isCompound: true },
      { slot: 'hamstring_isolation', muscleGroup: MuscleGroup.HAMSTRINGS, movementPattern: 'isolation', isCompound: false },
      { slot: 'glute_isolation', muscleGroup: MuscleGroup.GLUTES, movementPattern: 'isolation', isCompound: false },
      { slot: 'core_isolation', muscleGroup: MuscleGroup.ABS, movementPattern: 'isolation', isCompound: false },
    ],
    2: [
      { slot: 'chest_compound', muscleGroup: MuscleGroup.CHEST, movementPattern: 'push', isCompound: true },
      { slot: 'back_compound', muscleGroup: MuscleGroup.BACK, movementPattern: 'pull', isCompound: true },
      { slot: 'shoulder_isolation', muscleGroup: MuscleGroup.SHOULDERS, movementPattern: 'isolation', isCompound: false },
      { slot: 'tricep_isolation', muscleGroup: MuscleGroup.TRICEPS, movementPattern: 'isolation', isCompound: false },
      { slot: 'core_isolation', muscleGroup: MuscleGroup.ABS, movementPattern: 'isolation', isCompound: false },
    ],
    3: [
      { slot: 'glute_compound_primary', muscleGroup: MuscleGroup.GLUTES, movementPattern: 'hinge', isCompound: true },
      { slot: 'quad_compound', muscleGroup: MuscleGroup.QUADS, movementPattern: 'squat', isCompound: true },
      { slot: 'glute_isolation_kickback', muscleGroup: MuscleGroup.GLUTES, movementPattern: 'isolation', isCompound: false },
      { slot: 'calf_isolation', muscleGroup: MuscleGroup.CALVES, movementPattern: 'isolation', isCompound: false },
    ],
  },
  full_body_plus: {
    1: [
      { slot: 'quad_compound', muscleGroup: MuscleGroup.QUADS, movementPattern: 'squat', isCompound: true },
      { slot: 'chest_compound', muscleGroup: MuscleGroup.CHEST, movementPattern: 'push', isCompound: true },
      { slot: 'shoulder_compound', muscleGroup: MuscleGroup.SHOULDERS, movementPattern: 'push', isCompound: true },
      { slot: 'tricep_isolation', muscleGroup: MuscleGroup.TRICEPS, movementPattern: 'isolation', isCompound: false },
      { slot: 'core_isolation', muscleGroup: MuscleGroup.ABS, movementPattern: 'isolation', isCompound: false },
    ],
    2: [
      { slot: 'hamstring_compound', muscleGroup: MuscleGroup.HAMSTRINGS, movementPattern: 'hinge', isCompound: true },
      { slot: 'back_compound', muscleGroup: MuscleGroup.BACK, movementPattern: 'pull', isCompound: true },
      { slot: 'bicep_isolation', muscleGroup: MuscleGroup.BICEPS, movementPattern: 'isolation', isCompound: false },
      { slot: 'core_isolation', muscleGroup: MuscleGroup.ABS, movementPattern: 'isolation', isCompound: false },
    ],
    3: [
      { slot: 'glute_compound', muscleGroup: MuscleGroup.GLUTES, movementPattern: 'hinge', isCompound: true },
      { slot: 'quad_compound_accessory', muscleGroup: MuscleGroup.QUADS, movementPattern: 'lunge', isCompound: true },
      { slot: 'hamstring_isolation', muscleGroup: MuscleGroup.HAMSTRINGS, movementPattern: 'isolation', isCompound: false },
      { slot: 'calf_isolation', muscleGroup: MuscleGroup.CALVES, movementPattern: 'isolation', isCompound: false },
    ],
  },
  upper_lower: {
    1: [
      { slot: 'chest_compound', muscleGroup: MuscleGroup.CHEST, movementPattern: 'push', isCompound: true },
      { slot: 'back_compound', muscleGroup: MuscleGroup.BACK, movementPattern: 'pull', isCompound: true },
      { slot: 'shoulder_isolation', muscleGroup: MuscleGroup.SHOULDERS, movementPattern: 'isolation', isCompound: false },
      { slot: 'bicep_isolation', muscleGroup: MuscleGroup.BICEPS, movementPattern: 'isolation', isCompound: false },
      { slot: 'tricep_isolation', muscleGroup: MuscleGroup.TRICEPS, movementPattern: 'isolation', isCompound: false },
    ],
    2: [
      { slot: 'glute_compound', muscleGroup: MuscleGroup.GLUTES, movementPattern: 'hinge', isCompound: true },
      { slot: 'hamstring_compound', muscleGroup: MuscleGroup.HAMSTRINGS, movementPattern: 'hinge', isCompound: true },
      { slot: 'calf_isolation', muscleGroup: MuscleGroup.CALVES, movementPattern: 'isolation', isCompound: false },
      { slot: 'core_isolation', muscleGroup: MuscleGroup.ABS, movementPattern: 'isolation', isCompound: false },
    ],
    3: [
      { slot: 'back_compound', muscleGroup: MuscleGroup.BACK, movementPattern: 'pull', isCompound: true },
      { slot: 'chest_compound_accessory', muscleGroup: MuscleGroup.CHEST, movementPattern: 'push', isCompound: true },
      { slot: 'shoulder_compound', muscleGroup: MuscleGroup.SHOULDERS, movementPattern: 'push', isCompound: true },
      { slot: 'bicep_isolation', muscleGroup: MuscleGroup.BICEPS, movementPattern: 'isolation', isCompound: false },
    ],
    4: [
      { slot: 'quad_compound', muscleGroup: MuscleGroup.QUADS, movementPattern: 'squat', isCompound: true },
      { slot: 'glute_compound_accessory', muscleGroup: MuscleGroup.GLUTES, movementPattern: 'lunge', isCompound: true },
      { slot: 'core_isolation', muscleGroup: MuscleGroup.ABS, movementPattern: 'isolation', isCompound: false },
    ],
  },
  fat_loss_specialization: {
    1: [
      { slot: 'glute_compound', muscleGroup: MuscleGroup.GLUTES, movementPattern: 'hinge', isCompound: true },
      { slot: 'hamstring_compound', muscleGroup: MuscleGroup.HAMSTRINGS, movementPattern: 'hinge', isCompound: true },
      { slot: 'glute_isolation', muscleGroup: MuscleGroup.GLUTES, movementPattern: 'isolation', isCompound: false },
    ],
    2: [
      { slot: 'chest_compound', muscleGroup: MuscleGroup.CHEST, movementPattern: 'push', isCompound: true },
      { slot: 'back_compound', muscleGroup: MuscleGroup.BACK, movementPattern: 'pull', isCompound: true },
      { slot: 'shoulder_isolation', muscleGroup: MuscleGroup.SHOULDERS, movementPattern: 'isolation', isCompound: false },
      { slot: 'core_isolation', muscleGroup: MuscleGroup.ABS, movementPattern: 'isolation', isCompound: false },
    ],
    3: [
      { slot: 'full_body_cardio_1', muscleGroup: MuscleGroup.FULL_BODY, movementPattern: 'isolation', isCompound: false },
      { slot: 'full_body_cardio_2', muscleGroup: MuscleGroup.FULL_BODY, movementPattern: 'isolation', isCompound: false },
    ],
    4: [
      { slot: 'quad_compound', muscleGroup: MuscleGroup.QUADS, movementPattern: 'squat', isCompound: true },
      { slot: 'calf_isolation', muscleGroup: MuscleGroup.CALVES, movementPattern: 'isolation', isCompound: false },
      { slot: 'quad_isolation', muscleGroup: MuscleGroup.QUADS, movementPattern: 'isolation', isCompound: false },
    ],
    5: [
      { slot: 'shoulder_compound', muscleGroup: MuscleGroup.SHOULDERS, movementPattern: 'push', isCompound: true },
      { slot: 'back_compound_pull', muscleGroup: MuscleGroup.BACK, movementPattern: 'pull', isCompound: true },
      { slot: 'bicep_isolation', muscleGroup: MuscleGroup.BICEPS, movementPattern: 'isolation', isCompound: false },
    ],
  },
  push_pull_legs: {
    1: [
      { slot: 'chest_compound', muscleGroup: MuscleGroup.CHEST, movementPattern: 'push', isCompound: true },
      { slot: 'shoulder_compound', muscleGroup: MuscleGroup.SHOULDERS, movementPattern: 'push', isCompound: true },
      { slot: 'tricep_isolation', muscleGroup: MuscleGroup.TRICEPS, movementPattern: 'isolation', isCompound: false },
    ],
    2: [
      { slot: 'back_compound', muscleGroup: MuscleGroup.BACK, movementPattern: 'pull', isCompound: true },
      { slot: 'bicep_isolation', muscleGroup: MuscleGroup.BICEPS, movementPattern: 'isolation', isCompound: false },
      { slot: 'core_isolation', muscleGroup: MuscleGroup.ABS, movementPattern: 'isolation', isCompound: false },
    ],
    3: [
      { slot: 'quad_compound', muscleGroup: MuscleGroup.QUADS, movementPattern: 'squat', isCompound: true },
      { slot: 'hamstring_compound', muscleGroup: MuscleGroup.HAMSTRINGS, movementPattern: 'hinge', isCompound: true },
      { slot: 'glute_compound', muscleGroup: MuscleGroup.GLUTES, movementPattern: 'hinge', isCompound: true },
      { slot: 'calf_isolation', muscleGroup: MuscleGroup.CALVES, movementPattern: 'isolation', isCompound: false },
    ],
    4: [
      { slot: 'chest_compound_accessory', muscleGroup: MuscleGroup.CHEST, movementPattern: 'push', isCompound: true },
      { slot: 'back_compound_accessory', muscleGroup: MuscleGroup.BACK, movementPattern: 'pull', isCompound: true },
      { slot: 'shoulder_isolation', muscleGroup: MuscleGroup.SHOULDERS, movementPattern: 'isolation', isCompound: false },
      { slot: 'bicep_isolation', muscleGroup: MuscleGroup.BICEPS, movementPattern: 'isolation', isCompound: false },
    ],
    5: [
      { slot: 'glute_compound_primary', muscleGroup: MuscleGroup.GLUTES, movementPattern: 'hinge', isCompound: true },
      { slot: 'hamstring_isolation', muscleGroup: MuscleGroup.HAMSTRINGS, movementPattern: 'isolation', isCompound: false },
      { slot: 'quad_isolation', muscleGroup: MuscleGroup.QUADS, movementPattern: 'isolation', isCompound: false },
      { slot: 'core_isolation_crunch', muscleGroup: MuscleGroup.ABS, movementPattern: 'isolation', isCompound: false },
    ],
  },
};

export async function generateWorkoutPlan(options: GeneratorOptions) {
  const { userId, goal, experienceLevel, equipment, trainingDays, injuries } = options;

  // 1. Determine Workout Split / Program Type
  let programType = 'full_body';
  let workoutDayNames: { name: string; focus: string }[] = [];

  if (trainingDays <= 2) {
    programType = 'full_body';
    workoutDayNames = [
      { name: 'Full Body A', focus: 'Quadriceps, Chest, Back, Shoulders, Core' },
      { name: 'Full Body B', focus: 'Glutes, Hamstrings, Chest, Back, Arms' },
    ];
  } else if (trainingDays === 3) {
    if (goal === Goal.GLUTE_GROWTH) {
      programType = 'glute_specialization';
      workoutDayNames = [
        { name: 'Glute Specialization A', focus: 'Glutes, Hamstrings, Core' },
        { name: 'Upper Body & Abs', focus: 'Chest, Back, Shoulders, Arms, Core' },
        { name: 'Glute Specialization B', focus: 'Glutes, Quadriceps, Calves' },
      ];
    } else {
      programType = 'full_body_plus';
      workoutDayNames = [
        { name: 'Full Body Push', focus: 'Quadriceps, Chest, Shoulders, Triceps, Abs' },
        { name: 'Full Body Pull', focus: 'Hamstrings, Back, Biceps, Core' },
        { name: 'Full Body Legs/Glutes', focus: 'Glutes, Quads, Hamstrings, Calves' },
      ];
    }
  } else if (trainingDays === 4) {
    programType = 'upper_lower';
    workoutDayNames = [
      { name: 'Upper Body A', focus: 'Chest, Back, Shoulders, Biceps, Triceps' },
      { name: 'Lower Body A (Glutes/Hamstrings Focus)', focus: 'Glutes, Hamstrings, Calves, Core' },
      { name: 'Upper Body B', focus: 'Back, Chest, Shoulders, Arms' },
      { name: 'Lower Body B (Quadriceps Focus)', focus: 'Quadriceps, Glutes, Core' },
    ];
  } else {
    // 5 or 6 days
    if (goal === Goal.FAT_LOSS || goal === Goal.TONING) {
      programType = 'fat_loss_specialization';
      workoutDayNames = [
        { name: 'Lower Body (Glute Focus)', focus: 'Glutes, Hamstrings' },
        { name: 'Upper Body & Core', focus: 'Chest, Back, Shoulders, Abs' },
        { name: 'Active Recovery & Cardio', focus: 'Full Body Conditioning' },
        { name: 'Lower Body (Quad/Calf Focus)', focus: 'Quadriceps, Calves' },
        { name: 'Upper Body Shaping', focus: 'Shoulders, Arms, Back' },
      ];
    } else {
      programType = 'push_pull_legs';
      workoutDayNames = [
        { name: 'Push Day', focus: 'Chest, Shoulders, Triceps' },
        { name: 'Pull Day', focus: 'Back, Biceps, Core' },
        { name: 'Legs & Glutes', focus: 'Quadriceps, Hamstrings, Glutes, Calves' },
        { name: 'Upper Body', focus: 'Chest, Back, Shoulders, Arms' },
        { name: 'Lower Body & Core', focus: 'Glutes, Hamstrings, Quads, Abs' },
      ];
    }
  }

  // 2. Fetch all exercises and user exercise preferences from DB
  const allExercises = await prisma.exercise.findMany();
  const preferences = await prisma.userExercisePreference.findMany({
    where: { userId },
  });

  // 3. Create WorkoutPlan in Database
  const planName = `8-Week Custom ${goal.toLowerCase().replace('_', ' ')} Program`;
  const createdPlan = await prisma.workoutPlan.create({
    data: {
      userId,
      name: planName,
      programType,
      goal,
      difficulty: experienceLevel.toString(),
      durationWeeks: 8,
      currentWeek: 1,
      isActive: true,
    },
  });

  // Helper to pick exercise with 4 ranked alternatives and support user preference memory
  const pickExerciseWithAlternatives = (
    dayNumber: number,
    template: SlotTemplate,
    pool: typeof allExercises,
    avoidIds: Set<string>,
    count = 4
  ) => {
    const slotKey = `${programType}_d${dayNumber}_${template.slot}`;

    // Filter candidate list based on core constraints
    let candidates = pool.filter((ex) => {
      // Must be target muscle group
      if (ex.muscleGroup !== template.muscleGroup) return false;

      // Equipment compatibility
      if (!isEquipmentCompatible(equipment, ex.equipment)) return false;

      // Experience level: beginners can't do advanced exercises
      if (experienceLevel === Experience.BEGINNER && ex.difficulty === Difficulty.ADVANCED) {
        return false;
      }

      // Injury safety
      if (ex.contraindications) {
        try {
          const contra = JSON.parse(ex.contraindications);
          if (injuries.some((injury) => contra.includes(injury))) return false;
        } catch (e) {}
      }

      return true;
    });

    // Fallback if no matching exercises
    if (candidates.length === 0) {
      candidates = pool.filter((ex) => ex.muscleGroup === template.muscleGroup);
    }
    if (candidates.length === 0) {
      candidates = pool;
    }

    // Score and rank candidates
    const scored = candidates.map((ex) => {
      let score = 0;

      // Match movement pattern (+40 pts)
      if (ex.movementPattern === template.movementPattern) {
        score += 40;
      }

      // Match compound status (+10 pts)
      if (ex.isCompound === template.isCompound) {
        score += 10;
      }

      // Weekly Continuity: for compound slots, heavily prioritize user's preferred exercise (+1000 pts)
      if (template.isCompound) {
        const preference = preferences.find((p) => p.slotKey === slotKey && p.exerciseId === ex.id);
        if (preference) {
          score += 1000;
        }
      }

      // Add a slight random noise to prevent picking exactly the same items for accessory slots
      if (!template.isCompound) {
        score += Math.random() * 5;
      }

      return { ex, score };
    });

    // Sort by score descending
    const sorted = scored.sort((a, b) => b.score - a.score).map((s) => s.ex);

    // Primary exercise
    const primary = sorted[0];
    avoidIds.add(primary.id);

    // Filter out primary from candidates to get alternatives
    const altPool = sorted.filter((ex) => ex.id !== primary.id);
    const alternatives = altPool.slice(0, count);

    return {
      primary,
      alternatives,
    };
  };

  // 4. Build Workout Days and select Exercises
  const programTemplates = templates[programType] || templates.full_body;

  for (let i = 0; i < workoutDayNames.length; i++) {
    const dayConfig = workoutDayNames[i];
    const dayNumber = i + 1;

    const createdDay = await prisma.workoutDay.create({
      data: {
        workoutPlanId: createdPlan.id,
        dayNumber,
        name: dayConfig.name,
        focusArea: dayConfig.focus,
      },
    });

    const usedIds = new Set<string>();
    const dayExercisesToCreate: Prisma.WorkoutExerciseCreateManyInput[] = [];

    // Get the template slots for this day number (defaulting to Day 1 slots if not configured)
    const slots = programTemplates[dayNumber] || programTemplates[1] || [];

    slots.forEach((slotTemplate, idx) => {
      const { primary, alternatives } = pickExerciseWithAlternatives(
        dayNumber,
        slotTemplate,
        allExercises,
        usedIds
      );

      if (primary) {
        // Sets and rep range based on experience level and compound/isolation type
        let sets = 3;
        let repRange = '8-12';
        let restSeconds = 60;

        if (slotTemplate.isCompound) {
          sets = experienceLevel === Experience.ADVANCED ? 4 : 3;
          repRange = experienceLevel === Experience.ADVANCED ? '6-10' : '8-12';
          restSeconds = 90;
        } else {
          sets = 3;
          repRange = '12-15';
          restSeconds = 60;
        }

        const notes = slotTemplate.isCompound
          ? 'Focus on lifting with heavy controlled eccentric phase. Rest fully between sets.'
          : 'Focus on maximum squeeze and mind-muscle connection. Control the weight.';

        dayExercisesToCreate.push({
          workoutDayId: createdDay.id,
          exerciseId: primary.id,
          orderIndex: idx + 1,
          sets,
          targetReps: repRange,
          restSeconds,
          notes,
          slot: slotTemplate.slot,
          alternatives: JSON.stringify(alternatives.map((a) => a.id)),
        });
      }
    });

    if (dayExercisesToCreate.length > 0) {
      await prisma.workoutExercise.createMany({
        data: dayExercisesToCreate,
      });
    }
  }

  // Deactivate any other active plan for this user
  await prisma.workoutPlan.updateMany({
    where: {
      userId,
      id: { not: createdPlan.id },
      isActive: true,
    },
    data: { isActive: false },
  });

  return prisma.workoutPlan.findUnique({
    where: { id: createdPlan.id },
    include: {
      workoutDays: {
        include: {
          workoutExercises: {
            include: { exercise: true },
          },
        },
      },
    },
  });
}
