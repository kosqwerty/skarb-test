-- ================================================================
-- Довіреності: довідник + зв'язок з профілем
-- ================================================================

CREATE TABLE IF NOT EXISTS dovirenosti (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile_dovirenosti (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    dovirenost_id  uuid NOT NULL REFERENCES dovirenosti(id) ON DELETE CASCADE,
    created_at     timestamptz DEFAULT now(),
    UNIQUE(profile_id, dovirenost_id)
);

ALTER TABLE dovirenosti       ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_dovirenosti ENABLE ROW LEVEL SECURITY;

-- Всі авторизовані можуть читати довідник
CREATE POLICY "read dovirenosti" ON dovirenosti
    FOR SELECT TO authenticated USING (true);

-- Тільки адміни/власники можуть керувати довідником
CREATE POLICY "admin manage dovirenosti" ON dovirenosti
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );

-- Всі авторизовані можуть читати зв'язки
CREATE POLICY "read profile_dovirenosti" ON profile_dovirenosti
    FOR SELECT TO authenticated USING (true);

-- Тільки адміни/власники можуть керувати зв'язками
CREATE POLICY "admin manage profile_dovirenosti" ON profile_dovirenosti
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );
