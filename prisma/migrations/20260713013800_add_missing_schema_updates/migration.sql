-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN "isCompound" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WorkoutExercise" ADD COLUMN "slot" TEXT;
ALTER TABLE "WorkoutExercise" ADD COLUMN "alternatives" TEXT;

-- CreateTable
CREATE TABLE "UserExercisePreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserExercisePreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserExercisePreference_userId_slotKey_key" ON "UserExercisePreference"("userId", "slotKey");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_name_key" ON "Exercise"("name");

-- AddForeignKey
ALTER TABLE "UserExercisePreference" ADD CONSTRAINT "UserExercisePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExercisePreference" ADD CONSTRAINT "UserExercisePreference_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
