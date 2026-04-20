/*
  Warnings:

  - The `condition` column on the `achievements` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `book_carrier` on the `books` table. All the data in the column will be lost.
  - You are about to drop the column `book_url` on the `books` table. All the data in the column will be lost.
  - You are about to drop the column `summary` on the `books` table. All the data in the column will be lost.
  - You are about to drop the column `initial_completed` on the `tasks` table. All the data in the column will be lost.
  - You are about to drop the column `initial_unit` on the `tasks` table. All the data in the column will be lost.
  - You are about to drop the `achievement_unlocks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cloud_storage_configs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "achievement_unlocks" DROP CONSTRAINT "achievement_unlocks_achievement_id_fkey";

-- DropForeignKey
ALTER TABLE "achievement_unlocks" DROP CONSTRAINT "achievement_unlocks_child_id_fkey";

-- DropForeignKey
ALTER TABLE "books" DROP CONSTRAINT "books_child_id_fkey";

-- DropForeignKey
ALTER TABLE "cloud_storage_configs" DROP CONSTRAINT "cloud_storage_configs_family_id_fkey";

-- DropIndex
DROP INDEX "active_readings_book_id_idx";

-- DropIndex
DROP INDEX "active_readings_child_id_book_id_idx";

-- DropIndex
DROP INDEX "active_readings_child_id_idx";

-- DropIndex
DROP INDEX "active_readings_status_idx";

-- DropIndex
DROP INDEX "book_read_states_book_id_idx";

-- DropIndex
DROP INDEX "book_read_states_child_id_idx";

-- DropIndex
DROP INDEX "book_read_states_child_id_status_idx";

-- DropIndex
DROP INDEX "book_read_states_status_idx";

-- DropIndex
DROP INDEX "books_child_id_idx";

-- DropIndex
DROP INDEX "books_family_id_child_id_idx";

-- DropIndex
DROP INDEX "books_family_id_idx";

-- DropIndex
DROP INDEX "books_family_id_status_idx";

-- DropIndex
DROP INDEX "books_status_idx";

-- DropIndex
DROP INDEX "reading_logs_book_id_idx";

-- DropIndex
DROP INDEX "reading_logs_book_id_read_date_idx";

-- DropIndex
DROP INDEX "reading_logs_child_id_idx";

-- DropIndex
DROP INDEX "reading_logs_child_id_read_date_idx";

-- DropIndex
DROP INDEX "reading_logs_read_date_idx";

-- AlterTable
ALTER TABLE "achievements" DROP COLUMN "condition",
ADD COLUMN     "condition" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "books" DROP COLUMN "book_carrier",
DROP COLUMN "book_url",
DROP COLUMN "summary",
ALTER COLUMN "child_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "initial_completed",
DROP COLUMN "initial_unit";

-- DropTable
DROP TABLE "achievement_unlocks";

-- DropTable
DROP TABLE "cloud_storage_configs";

-- CreateTable
CREATE TABLE "achievement_logs" (
    "id" SERIAL NOT NULL,
    "family_id" INTEGER NOT NULL,
    "child_id" INTEGER NOT NULL,
    "achievement_id" INTEGER NOT NULL,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievement_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" SERIAL NOT NULL,
    "family_id" INTEGER NOT NULL,
    "child_id" INTEGER,
    "type" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" JSONB NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_auto_generated" BOOLEAN NOT NULL DEFAULT false,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_family_id_type_idx" ON "reports"("family_id", "type");

-- CreateIndex
CREATE INDEX "reports_family_id_created_at_idx" ON "reports"("family_id", "created_at");

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_logs" ADD CONSTRAINT "achievement_logs_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_logs" ADD CONSTRAINT "achievement_logs_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
