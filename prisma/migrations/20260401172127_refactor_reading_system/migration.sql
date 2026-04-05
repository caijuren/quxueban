/*
  Warnings:

  - You are about to drop the column `target` on the `books` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "books" DROP COLUMN "target",
ADD COLUMN     "character_tag" VARCHAR(50) NOT NULL DEFAULT '',
ADD COLUMN     "read_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_pages" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "active_readings" (
    "id" SERIAL NOT NULL,
    "family_id" INTEGER NOT NULL,
    "child_id" INTEGER NOT NULL,
    "book_id" INTEGER NOT NULL,
    "read_pages" INTEGER NOT NULL DEFAULT 0,
    "read_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'reading',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "active_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_progress_logs" (
    "id" SERIAL NOT NULL,
    "family_id" INTEGER NOT NULL,
    "child_id" INTEGER NOT NULL,
    "book_id" INTEGER NOT NULL,
    "active_reading_id" INTEGER NOT NULL,
    "pages_read" INTEGER NOT NULL,
    "total_read_pages" INTEGER NOT NULL,
    "read_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_progress_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "active_readings_child_id_book_id_status_key" ON "active_readings"("child_id", "book_id", "status");

-- AddForeignKey
ALTER TABLE "active_readings" ADD CONSTRAINT "active_readings_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_readings" ADD CONSTRAINT "active_readings_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_readings" ADD CONSTRAINT "active_readings_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress_logs" ADD CONSTRAINT "reading_progress_logs_active_reading_id_fkey" FOREIGN KEY ("active_reading_id") REFERENCES "active_readings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
