-- CreateTable
CREATE TABLE "cloud_storage_configs" (
    "id" TEXT NOT NULL,
    "family_id" INTEGER NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cloud_storage_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cloud_storage_configs_family_id_provider_key" ON "cloud_storage_configs"("family_id", "provider");

-- AddForeignKey
ALTER TABLE "cloud_storage_configs" ADD CONSTRAINT "cloud_storage_configs_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
