/*
  Warnings:

  - Made the column `effect` on table `reading_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `performance` on table `reading_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `note` on table `reading_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `read_stage` on table `reading_logs` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "reading_logs" DROP CONSTRAINT "reading_logs_child_id_fkey";

-- AlterTable
ALTER TABLE "books" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "isbn" VARCHAR(20) NOT NULL DEFAULT '',
ADD COLUMN     "publisher" VARCHAR(100) NOT NULL DEFAULT '',
ADD COLUMN     "word_count" INTEGER,
ALTER COLUMN "cover_url" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "daily_checkins" ADD COLUMN     "completed_value" INTEGER,
ADD COLUMN     "notes" VARCHAR(500);

-- AlterTable
ALTER TABLE "reading_logs" ADD COLUMN     "focus_rating" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tags" JSONB NOT NULL DEFAULT '[]',
ALTER COLUMN "child_id" DROP NOT NULL,
ALTER COLUMN "effect" SET NOT NULL,
ALTER COLUMN "performance" SET NOT NULL,
ALTER COLUMN "note" SET NOT NULL,
ALTER COLUMN "read_stage" SET NOT NULL;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "schedule_rule" VARCHAR(20) NOT NULL DEFAULT 'daily',
ADD COLUMN     "target_value" INTEGER,
ADD COLUMN     "tracking_type" VARCHAR(20) NOT NULL DEFAULT 'simple',
ADD COLUMN     "tracking_unit" VARCHAR(20),
ADD COLUMN     "weekly_frequency" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dingtalk_secret" VARCHAR(100) DEFAULT '',
ADD COLUMN     "dingtalk_webhook" VARCHAR(500) DEFAULT '',
ADD COLUMN     "dingtalk_webhook_url" VARCHAR(500) DEFAULT '',
ALTER COLUMN "avatar" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "weekly_plans" ADD COLUMN     "assigned_days" JSONB DEFAULT '[]';

-- CreateTable
CREATE TABLE "task_templates" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "subject" VARCHAR(30),
    "single_duration" INTEGER NOT NULL DEFAULT 30,
    "difficulty" VARCHAR(20) DEFAULT 'basic',
    "description" TEXT,
    "cover_url" VARCHAR(500),
    "schedule_rule" VARCHAR(20) NOT NULL DEFAULT 'daily',
    "default_weekly_target" INTEGER,
    "family_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_tasks" (
    "id" SERIAL NOT NULL,
    "child_id" INTEGER NOT NULL,
    "task_template_id" INTEGER NOT NULL,
    "custom_name" VARCHAR(100),
    "custom_duration" INTEGER,
    "custom_schedule_rule" VARCHAR(20),
    "weekly_target" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "skip_holidays" BOOLEAN NOT NULL DEFAULT true,
    "exclude_days" VARCHAR(50),
    "family_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_read_states" (
    "id" SERIAL NOT NULL,
    "family_id" INTEGER NOT NULL,
    "child_id" INTEGER NOT NULL,
    "book_id" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'want_to_read',
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_read_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "child_tasks_child_id_task_template_id_key" ON "child_tasks"("child_id", "task_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "book_read_states_child_id_book_id_key" ON "book_read_states"("child_id", "book_id");

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_tasks" ADD CONSTRAINT "child_tasks_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_tasks" ADD CONSTRAINT "child_tasks_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_tasks" ADD CONSTRAINT "child_tasks_task_template_id_fkey" FOREIGN KEY ("task_template_id") REFERENCES "task_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_logs" ADD CONSTRAINT "reading_logs_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_read_states" ADD CONSTRAINT "book_read_states_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_read_states" ADD CONSTRAINT "book_read_states_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_read_states" ADD CONSTRAINT "book_read_states_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
