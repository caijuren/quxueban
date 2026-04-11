-- CreateTable
CREATE TABLE "families" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "family_code" VARCHAR(20) NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT '🐛',
    "password_hash" VARCHAR(255) NOT NULL,
    "family_id" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "dingtalk_secret" VARCHAR(100) DEFAULT '',
    "dingtalk_webhook" VARCHAR(500) DEFAULT '',
    "dingtalk_webhook_url" VARCHAR(500) DEFAULT '',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "tasks" (
    "id" SERIAL NOT NULL,
    "family_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "time_per_unit" INTEGER NOT NULL DEFAULT 30,
    "weekly_rule" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tags" JSONB DEFAULT '{}',
    "applies_to" JSONB DEFAULT '[]',
    "schedule_rule" VARCHAR(20) NOT NULL DEFAULT 'daily',
    "target_value" INTEGER,
    "tracking_type" VARCHAR(20) NOT NULL DEFAULT 'simple',
    "tracking_unit" VARCHAR(20),
    "weekly_frequency" INTEGER,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_plans" (
    "id" SERIAL NOT NULL,
    "family_id" INTEGER NOT NULL,
    "child_id" INTEGER NOT NULL,
    "task_id" INTEGER NOT NULL,
    "target" INTEGER NOT NULL DEFAULT 1,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "week_no" VARCHAR(10) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "assigned_days" JSONB DEFAULT '[]',

    CONSTRAINT "weekly_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_checkins" (
    "id" SERIAL NOT NULL,
    "family_id" INTEGER NOT NULL,
    "child_id" INTEGER NOT NULL,
    "task_id" INTEGER NOT NULL,
    "plan_id" INTEGER,
    "status" VARCHAR(20) NOT NULL,
    "value" INTEGER,
    "check_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_value" INTEGER,
    "notes" VARCHAR(500),

    CONSTRAINT "daily_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" SERIAL NOT NULL,
    "family_id" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "author" VARCHAR(100) NOT NULL DEFAULT '',
    "type" VARCHAR(30) NOT NULL DEFAULT 'fiction',
    "cover_url" TEXT NOT NULL DEFAULT '',
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "character_tag" VARCHAR(50) NOT NULL DEFAULT '',
    "read_count" INTEGER NOT NULL DEFAULT 0,
    "total_pages" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',
    "isbn" VARCHAR(20) NOT NULL DEFAULT '',
    "publisher" VARCHAR(100) NOT NULL DEFAULT '',
    "word_count" INTEGER,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "reading_logs" (
    "id" SERIAL NOT NULL,
    "family_id" INTEGER NOT NULL,
    "child_id" INTEGER,
    "book_id" INTEGER NOT NULL,
    "pages" INTEGER NOT NULL DEFAULT 0,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "read_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effect" VARCHAR(50) NOT NULL DEFAULT '',
    "performance" VARCHAR(200) NOT NULL DEFAULT '',
    "note" VARCHAR(500) NOT NULL DEFAULT '',
    "read_stage" VARCHAR(50) NOT NULL DEFAULT '',
    "focus_rating" INTEGER NOT NULL DEFAULT 0,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "end_page" INTEGER NOT NULL DEFAULT 0,
    "evidence_url" VARCHAR(255) NOT NULL DEFAULT '',
    "start_page" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "reading_logs_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "achievements" (
    "id" SERIAL NOT NULL,
    "family_id" INTEGER NOT NULL,
    "icon" VARCHAR(10) NOT NULL DEFAULT '🏆',
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200) NOT NULL DEFAULT '',
    "condition" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_logs" (
    "id" SERIAL NOT NULL,
    "family_id" INTEGER NOT NULL,
    "child_id" INTEGER NOT NULL,
    "achievement_id" INTEGER NOT NULL,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievement_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "families_family_code_key" ON "families"("family_code");

-- CreateIndex
CREATE UNIQUE INDEX "child_tasks_child_id_task_template_id_key" ON "child_tasks"("child_id", "task_template_id");

-- CreateIndex
CREATE INDEX "tasks_family_id_idx" ON "tasks"("family_id");

-- CreateIndex
CREATE INDEX "tasks_is_active_idx" ON "tasks"("is_active");

-- CreateIndex
CREATE INDEX "tasks_family_id_is_active_idx" ON "tasks"("family_id", "is_active");

-- CreateIndex
CREATE INDEX "weekly_plans_child_id_idx" ON "weekly_plans"("child_id");

-- CreateIndex
CREATE INDEX "weekly_plans_week_no_idx" ON "weekly_plans"("week_no");

-- CreateIndex
CREATE INDEX "weekly_plans_child_id_week_no_idx" ON "weekly_plans"("child_id", "week_no");

-- CreateIndex
CREATE INDEX "daily_checkins_child_id_idx" ON "daily_checkins"("child_id");

-- CreateIndex
CREATE INDEX "daily_checkins_check_date_idx" ON "daily_checkins"("check_date");

-- CreateIndex
CREATE INDEX "daily_checkins_child_id_check_date_idx" ON "daily_checkins"("child_id", "check_date");

-- CreateIndex
CREATE INDEX "daily_checkins_plan_id_idx" ON "daily_checkins"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "active_readings_child_id_book_id_status_key" ON "active_readings"("child_id", "book_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "book_read_states_child_id_book_id_key" ON "book_read_states"("child_id", "book_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_tasks" ADD CONSTRAINT "child_tasks_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_tasks" ADD CONSTRAINT "child_tasks_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_tasks" ADD CONSTRAINT "child_tasks_task_template_id_fkey" FOREIGN KEY ("task_template_id") REFERENCES "task_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plans" ADD CONSTRAINT "weekly_plans_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plans" ADD CONSTRAINT "weekly_plans_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plans" ADD CONSTRAINT "weekly_plans_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_checkins" ADD CONSTRAINT "daily_checkins_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_checkins" ADD CONSTRAINT "daily_checkins_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "weekly_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_readings" ADD CONSTRAINT "active_readings_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_readings" ADD CONSTRAINT "active_readings_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_readings" ADD CONSTRAINT "active_readings_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress_logs" ADD CONSTRAINT "reading_progress_logs_active_reading_id_fkey" FOREIGN KEY ("active_reading_id") REFERENCES "active_readings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_logs" ADD CONSTRAINT "reading_logs_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_logs" ADD CONSTRAINT "reading_logs_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_read_states" ADD CONSTRAINT "book_read_states_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_read_states" ADD CONSTRAINT "book_read_states_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_read_states" ADD CONSTRAINT "book_read_states_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_ai_insights" ADD CONSTRAINT "book_ai_insights_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_ai_insights" ADD CONSTRAINT "book_ai_insights_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_ai_insights" ADD CONSTRAINT "book_ai_insights_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_logs" ADD CONSTRAINT "achievement_logs_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_logs" ADD CONSTRAINT "achievement_logs_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
