/*
  Warnings:

  - Added the required column `child_id` to the `books` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "books" ADD COLUMN     "child_id" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "books_child_id_idx" ON "books"("child_id");

-- CreateIndex
CREATE INDEX "books_family_id_child_id_idx" ON "books"("family_id", "child_id");

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
