-- v38: resource_dovirenosti — прив'язка довіреностей до ресурсів
CREATE TABLE IF NOT EXISTS resource_dovirenosti (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id    uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    dovirenost_id  uuid NOT NULL REFERENCES dovirenosti(id) ON DELETE CASCADE,
    created_at     timestamptz DEFAULT now(),
    UNIQUE(resource_id, dovirenost_id)
);

ALTER TABLE resource_dovirenosti ENABLE ROW LEVEL SECURITY;

-- Всі авторизовані можуть читати
CREATE POLICY "read resource_dovirenosti" ON resource_dovirenosti
    FOR SELECT TO authenticated USING (true);

-- Стаф може керувати
CREATE POLICY "staff manage resource_dovirenosti" ON resource_dovirenosti
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
                AND role IN ('admin','owner','smm','teacher','manager'))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
                AND role IN ('admin','owner','smm','teacher','manager'))
    );
