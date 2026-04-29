-- ================================================================
-- Migration v20: Document download tracking
-- ================================================================

-- Flag on resources: requires tracked download
ALTER TABLE resources ADD COLUMN IF NOT EXISTS is_tracked_download boolean NOT NULL DEFAULT false;

-- Timestamp for "current version" check
ALTER TABLE resources ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Auto-update updated_at when resource file/data changes
CREATE OR REPLACE FUNCTION resources_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS resources_updated_at ON resources;
CREATE TRIGGER resources_updated_at
    BEFORE UPDATE ON resources
    FOR EACH ROW EXECUTE FUNCTION resources_set_updated_at();

-- Download log
CREATE TABLE IF NOT EXISTS document_downloads (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id   uuid        NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    location_id   uuid        REFERENCES schedule_locations(id) ON DELETE SET NULL,
    downloaded_at timestamptz NOT NULL DEFAULT now(),
    is_off_shift  boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS dd_resource_idx  ON document_downloads(resource_id);
CREATE INDEX IF NOT EXISTS dd_user_idx      ON document_downloads(user_id);
CREATE INDEX IF NOT EXISTS dd_location_idx  ON document_downloads(location_id);

ALTER TABLE document_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dd_select" ON document_downloads FOR SELECT USING (true);
CREATE POLICY "dd_insert" ON document_downloads FOR INSERT WITH CHECK (auth.uid() = user_id);
