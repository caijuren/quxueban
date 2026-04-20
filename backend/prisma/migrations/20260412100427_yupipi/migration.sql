-- CreateIndex
CREATE INDEX "active_readings_child_id_idx" ON "active_readings"("child_id");

-- CreateIndex
CREATE INDEX "active_readings_book_id_idx" ON "active_readings"("book_id");

-- CreateIndex
CREATE INDEX "active_readings_child_id_book_id_idx" ON "active_readings"("child_id", "book_id");

-- CreateIndex
CREATE INDEX "active_readings_status_idx" ON "active_readings"("status");

-- CreateIndex
CREATE INDEX "book_read_states_child_id_idx" ON "book_read_states"("child_id");

-- CreateIndex
CREATE INDEX "book_read_states_book_id_idx" ON "book_read_states"("book_id");

-- CreateIndex
CREATE INDEX "book_read_states_status_idx" ON "book_read_states"("status");

-- CreateIndex
CREATE INDEX "book_read_states_child_id_status_idx" ON "book_read_states"("child_id", "status");

-- CreateIndex
CREATE INDEX "books_family_id_idx" ON "books"("family_id");

-- CreateIndex
CREATE INDEX "books_status_idx" ON "books"("status");

-- CreateIndex
CREATE INDEX "books_family_id_status_idx" ON "books"("family_id", "status");

-- CreateIndex
CREATE INDEX "reading_logs_child_id_idx" ON "reading_logs"("child_id");

-- CreateIndex
CREATE INDEX "reading_logs_book_id_idx" ON "reading_logs"("book_id");

-- CreateIndex
CREATE INDEX "reading_logs_read_date_idx" ON "reading_logs"("read_date");

-- CreateIndex
CREATE INDEX "reading_logs_child_id_read_date_idx" ON "reading_logs"("child_id", "read_date");

-- CreateIndex
CREATE INDEX "reading_logs_book_id_read_date_idx" ON "reading_logs"("book_id", "read_date");
