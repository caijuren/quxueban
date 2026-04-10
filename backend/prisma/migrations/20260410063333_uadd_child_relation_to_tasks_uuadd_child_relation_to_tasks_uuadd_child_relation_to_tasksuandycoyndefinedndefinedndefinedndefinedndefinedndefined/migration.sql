-- CreateIndex
CREATE INDEX "daily_checkins_child_id_idx" ON "daily_checkins"("child_id");

-- CreateIndex
CREATE INDEX "daily_checkins_check_date_idx" ON "daily_checkins"("check_date");

-- CreateIndex
CREATE INDEX "daily_checkins_child_id_check_date_idx" ON "daily_checkins"("child_id", "check_date");

-- CreateIndex
CREATE INDEX "daily_checkins_plan_id_idx" ON "daily_checkins"("plan_id");

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
