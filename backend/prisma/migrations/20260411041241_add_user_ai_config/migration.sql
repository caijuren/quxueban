-- CreateTable
CREATE TABLE "user_ai_configs" (
    "id" SERIAL NOT NULL,
    "family_id" INTEGER NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_ai_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_ai_configs_family_id_provider_key" ON "user_ai_configs"("family_id", "provider");

-- AddForeignKey
ALTER TABLE "user_ai_configs" ADD CONSTRAINT "user_ai_configs_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
