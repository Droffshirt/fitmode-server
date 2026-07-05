export interface ProgressedVariables {
  week: number;
  sets: number;
  reps: string;
  weightMultiplier: number;
  restSeconds: number;
  notes: string;
  intensityDesc: string;
}

/**
 * Computes progressive overload variables for a given week of an 8-week program.
 * 
 * @param week Current week of program (1 to 8)
 * @param baseSets Standard sets for the exercise
 * @param baseReps Standard reps target (e.g. "8-12")
 * @param baseRest Standard rest time in seconds
 */
export function calculateProgressionForWeek(
  week: number,
  baseSets: number,
  baseReps: string,
  baseRest: number
): ProgressedVariables {
  // Normalize week bounds (1 to 8)
  const activeWeek = Math.max(1, Math.min(8, week));

  let sets = baseSets;
  let reps = baseReps;
  let weightMultiplier = 1.0;
  let restSeconds = baseRest;
  let intensityDesc = 'Technique Focus & Conditioning';
  let notes = 'Focus on controlled eccentric (lowering) phase and perfect form.';

  if (activeWeek <= 2) {
    // Weeks 1-2: Technique focus, lower intensity
    sets = baseSets;
    reps = baseReps;
    weightMultiplier = 0.9; // 90% of working weight for safety
    restSeconds = baseRest;
    intensityDesc = 'Technique Focus & Lower Intensity';
    notes = 'Start light. Perfect your setup, brace your core, and establish strong mind-muscle connection.';
  } else if (activeWeek <= 5) {
    // Weeks 3-5: Progressive overload begins, slight weight increase
    sets = baseSets;
    reps = baseReps;
    weightMultiplier = 1.0; // 100% working weight
    restSeconds = baseRest;
    intensityDesc = 'Progressive Overload Phase';
    notes = 'Increase weight slightly if you reached top rep targets last week. Target RIR 2-3 (2-3 reps left in tank).';
  } else {
    // Weeks 6-8: Higher intensity, reduced rest periods, increased challenge
    sets = baseSets + 1; // Add an extra set for volume
    
    // Slight rep adjustment for higher intensity
    if (baseReps === '10-12') {
      reps = '8-10';
    } else if (baseReps === '8-12') {
      reps = '6-10';
    }
    
    weightMultiplier = 1.05; // 105% of working weight if comfortable
    restSeconds = Math.max(45, baseRest - 15); // Reduce rest time by 15s (min 45s)
    intensityDesc = 'High Intensity Peak Phase';
    notes = 'Peak volume. Push close to failure (RIR 1-2). Keep rest short and force high muscle fiber recruitment!';
  }

  return {
    week: activeWeek,
    sets,
    reps,
    weightMultiplier,
    restSeconds,
    intensityDesc,
    notes,
  };
}
