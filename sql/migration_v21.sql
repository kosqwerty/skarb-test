-- ================================================================
-- Migration v21: Document deadlines, versioning, reminder tracking
-- ================================================================

-- Deadline in days after created_at (null = no deadline)
ALTER TABLE resources ADD COLUMN IF NOT EXISTS deadline_days int DEFAULT NULL;

-- Document version — bump when file is replaced, forces re-acknowledgment
ALTER TABLE resources ADD COLUMN IF NOT EXISTS doc_version int NOT NULL DEFAULT 1;

-- Track which doc version was acknowledged
ALTER TABLE document_downloads ADD COLUMN IF NOT EXISTS doc_version int NOT NULL DEFAULT 1;

-- Prevent duplicate deadline reminders per user per document
CREATE TABLE IF NOT EXISTS doc_deadline_reminders (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id uuid        NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notified_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(resource_id, user_id)
);
ALTER TABLE doc_deadline_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ddr_select" ON doc_deadline_reminders FOR SELECT USING (true);
CREATE POLICY "ddr_insert" ON doc_deadline_reminders FOR INSERT WITH CHECK (true);

-- Index for fast deadline reminder lookups
CREATE INDEX IF NOT EXISTS ddr_user_idx ON doc_deadline_reminders(user_id);
