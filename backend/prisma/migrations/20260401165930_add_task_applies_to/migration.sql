-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "applies_to" JSONB DEFAULT '[]';
