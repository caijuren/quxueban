-- AlterTable
ALTER TABLE "books" ADD COLUMN     "book_carrier" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "book_url" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "summary" TEXT NOT NULL DEFAULT '';
