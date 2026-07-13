import { generateWorkoutPlan } from './src/engine/workout-generator.js';
import { Goal, Experience, Equipment } from '@prisma/client';

async function main() {
  try {
    console.log('Running generateWorkoutPlan...');
    const result = await generateWorkoutPlan({
      userId: 'f53ed3b8-d972-4a80-8c8a-bb1fcf937e06', // Test User ID
      gender: 'FEMALE',
      goal: Goal.GLUTE_GROWTH,
      experienceLevel: Experience.BEGINNER,
      equipment: Equipment.GYM,
      trainingDays: 3,
      injuries: ['ACUTE_LOWER_BACK_PAIN'],
    });
    console.log('Success! Result:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('Error during generateWorkoutPlan:', error);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

main();
