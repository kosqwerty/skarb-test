-- ================================================================
-- Migration v75: registry_items + registry_docs (Реєстри НПА)
-- ================================================================

-- Теми реєстру
CREATE TABLE IF NOT EXISTS registry_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic       TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Документи прив'язані до теми
CREATE TABLE IF NOT EXISTS registry_docs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registry_item_id UUID NOT NULL REFERENCES registry_items(id) ON DELETE CASCADE,
    type             TEXT NOT NULL CHECK (type IN ('order','disposition')),
    resource_id      UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    order_index      INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS registry_docs_item_idx ON registry_docs(registry_item_id);
CREATE INDEX IF NOT EXISTS registry_docs_resource_idx ON registry_docs(resource_id);

-- RLS
ALTER TABLE registry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_docs  ENABLE ROW LEVEL SECURITY;

-- registry_items policies
CREATE POLICY "registry_items_select_all" ON registry_items
    FOR SELECT USING (true);

CREATE POLICY "registry_items_admin_insert" ON registry_items
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );

CREATE POLICY "registry_items_admin_update" ON registry_items
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );

CREATE POLICY "registry_items_admin_delete" ON registry_items
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );

-- registry_docs policies
CREATE POLICY "registry_docs_select_all" ON registry_docs
    FOR SELECT USING (true);

CREATE POLICY "registry_docs_admin_insert" ON registry_docs
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );

CREATE POLICY "registry_docs_admin_update" ON registry_docs
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );

CREATE POLICY "registry_docs_admin_delete" ON registry_docs
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );
