-- AlterTable
ALTER TABLE "daily_checkins" ADD COLUMN     "completed_value" INTEGER,
ADD COLUMN     "notes" VARCHAR(500);

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "target_value" INTEGER,
ADD COLUMN     "tracking_type" VARCHAR(20) NOT NULL DEFAULT 'simple',
ADD COLUMN     "tracking_unit" VARCHAR(20);

