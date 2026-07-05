import { Exercise, Equipment, Experience } from '@prisma/client';

export interface RankedAlternative {
  exercise: Exercise;
  score: number;
}

/**
 * Checks if an exercise is compatible with the user's equipment availability.
 */
export function isEquipmentCompatible(userEquipment: Equipment, exerciseEquipment: Equipment): boolean {
  if (userEquipment === Equipment.GYM || userEquipment === Equipment.BOTH) {
    return true;
  }
  if (userEquipment === Equipment.HOME) {
    // Home user can only do HOME, MINIMAL, or BOTH
    return (
      exerciseEquipment === Equipment.HOME ||
      exerciseEquipment === Equipment.MINIMAL ||
      exerciseEquipment === Equipment.BOTH
    );
  }
  if (userEquipment === Equipment.MINIMAL) {
    // Minimal user can do MINIMAL, HOME, or BOTH
    return (
      exerciseEquipment === Equipment.MINIMAL ||
      exerciseEquipment === Equipment.HOME ||
      exerciseEquipment === Equipment.BOTH
    );
  }
  return true;
}

/**
 * Logic for validating and ranking substitutions for a target exercise.
 */
export function getCompatibleAlternatives(
  targetExercise: Exercise,
  pool: Exercise[],
  userEquipment: Equipment,
  userLevel: Experience,
  injuries: string[],
  limit: number = 5
): RankedAlternative[] {
  // Filter and score the pool
  const scored = pool
    .filter((exercise) => {
      // 1. Must be a different exercise
      if (exercise.id === targetExercise.id) return false;

      // 2. Must target the same primary muscle group
      if (exercise.muscleGroup !== targetExercise.muscleGroup) return false;

      // 3. Equipment compatibility filter
      if (!isEquipmentCompatible(userEquipment, exercise.equipment)) return false;

      // 4. Experience level safety filter: beginners shouldn't be given advanced exercises
      if (userLevel === Experience.BEGINNER && exercise.difficulty === 'ADVANCED') {
        return false;
      }

      // 5. Injury safety filter (contraindications)
      if (exercise.contraindications) {
        try {
          const contra: string[] = JSON.parse(exercise.contraindications);
          const hasConflict = injuries.some((injury) => contra.includes(injury));
          if (hasConflict) return false;
        } catch (e) {
          // Ignore parse errors, treat as no conflict
        }
      }

      return true;
    })
    .map((exercise) => {
      let score = 0;

      // Same movement pattern is highly valued (+40 pts)
      if (exercise.movementPattern === targetExercise.movementPattern) {
        score += 40;
      }

      // Same difficulty is valued (+15 pts)
      if (exercise.difficulty === targetExercise.difficulty) {
        score += 15;
      }

      // Same equipment type (+10 pts)
      if (exercise.equipment === targetExercise.equipment) {
        score += 10;
      }

      // isCompound matches (+5 pts)
      if (exercise.isCompound === targetExercise.isCompound) {
        score += 5;
      }

      return { exercise, score };
    });

  // Sort by score descending and return top N
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
