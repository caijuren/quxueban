-- AlterTable
ALTER TABLE "reading_logs" ADD COLUMN     "end_page" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "evidence_url" VARCHAR(255) NOT NULL DEFAULT '',
ADD COLUMN     "start_page" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "book_ai_insights" (
    "id" SERIAL NOT NULL,
    "family_id" INTEGER NOT NULL,
    "book_id" INTEGER NOT NULL,
    "child_id" INTEGER,
    "insights" JSONB NOT NULL DEFAULT '{}',
    "report_url" TEXT NOT NULL DEFAULT '',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_ai_insights_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "book_ai_insights" ADD CONSTRAINT "book_ai_insights_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_ai_insights" ADD CONSTRAINT "book_ai_insights_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_ai_insights" ADD CONSTRAINT "book_ai_insights_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
