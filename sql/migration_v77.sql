-- v77: registry_sections + registry_section_docs (Реєстри — розділи з документами)
-- dovirenost_id на registry_sections — доступ до розділу по довіреності

CREATE TABLE IF NOT EXISTS registry_sections (
    id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    title          TEXT        NOT NULL,
    dovirenost_id  UUID        REFERENCES dovirenosti(id) ON DELETE SET NULL,
    order_index    INT         DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Якщо таблиця вже існує без dovirenost_id — додаємо
ALTER TABLE registry_sections
    ADD COLUMN IF NOT EXISTS dovirenost_id UUID REFERENCES dovirenosti(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS registry_section_docs (
    id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    section_id     UUID        NOT NULL REFERENCES registry_sections(id) ON DELETE CASCADE,
    resource_id    UUID        NOT NULL REFERENCES resources(id)         ON DELETE CASCADE,
    order_index    INT         DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(section_id, resource_id)
);

-- section_id на registry_items — теми можуть належати розділу
ALTER TABLE registry_items
    ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES registry_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS registry_section_docs_sec_idx  ON registry_section_docs(section_id);
CREATE INDEX IF NOT EXISTS registry_section_docs_res_idx  ON registry_section_docs(resource_id);
CREATE INDEX IF NOT EXISTS registry_sections_dov_idx      ON registry_sections(dovirenost_id);
CREATE INDEX IF NOT EXISTS registry_items_section_idx     ON registry_items(section_id);

ALTER TABLE registry_sections      ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_section_docs  ENABLE ROW LEVEL SECURITY;

-- registry_sections policies
DROP POLICY IF EXISTS "registry_sections_select_all"    ON registry_sections;
DROP POLICY IF EXISTS "registry_sections_admin_insert"  ON registry_sections;
DROP POLICY IF EXISTS "registry_sections_admin_update"  ON registry_sections;
DROP POLICY IF EXISTS "registry_sections_admin_delete"  ON registry_sections;

CREATE POLICY "registry_sections_select_all" ON registry_sections
    FOR SELECT USING (true);
CREATE POLICY "registry_sections_admin_insert" ON registry_sections
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','admin'))
    );
CREATE POLICY "registry_sections_admin_update" ON registry_sections
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','admin'))
    );
CREATE POLICY "registry_sections_admin_delete" ON registry_sections
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','admin'))
    );

-- registry_section_docs policies
DROP POLICY IF EXISTS "registry_section_docs_select_all"   ON registry_section_docs;
DROP POLICY IF EXISTS "registry_section_docs_admin_insert" ON registry_section_docs;
DROP POLICY IF EXISTS "registry_section_docs_admin_delete" ON registry_section_docs;

CREATE POLICY "registry_section_docs_select_all" ON registry_section_docs
    FOR SELECT USING (true);
CREATE POLICY "registry_section_docs_admin_insert" ON registry_section_docs
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','admin'))
    );
CREATE POLICY "registry_section_docs_admin_delete" ON registry_section_docs
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','admin'))
    );
