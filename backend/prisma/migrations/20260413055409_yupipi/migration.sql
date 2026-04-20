/*
  Warnings:

  - You are about to alter the column `condition` on the `achievements` table. The data in that column could be lost. The data in that column will be cast from `JsonB` to `VarChar(200)`.
  - You are about to drop the `achievement_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "achievement_logs" DROP CONSTRAINT "achievement_logs_achievement_id_fkey";

-- DropForeignKey
ALTER TABLE "achievement_logs" DROP CONSTRAINT "achievement_logs_child_id_fkey";

-- AlterTable
ALTER TABLE "achievements" ALTER COLUMN "condition" SET DEFAULT '',
ALTER COLUMN "condition" SET DATA TYPE VARCHAR(200);

-- DropTable
DROP TABLE "achievement_logs";

-- CreateTable
CREATE TABLE "achievement_unlocks" (
    "id" SERIAL NOT NULL,
    "family_id" INTEGER NOT NULL,
    "child_id" INTEGER NOT NULL,
    "achievement_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievement_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "achievement_unlocks_child_id_achievement_id_key" ON "achievement_unlocks"("child_id", "achievement_id");

-- AddForeignKey
ALTER TABLE "achievement_unlocks" ADD CONSTRAINT "achievement_unlocks_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_unlocks" ADD CONSTRAINT "achievement_unlocks_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
