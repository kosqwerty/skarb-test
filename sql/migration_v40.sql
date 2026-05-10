-- v40: додаткові спроби тесту від адміністратора
CREATE TABLE IF NOT EXISTS test_attempt_grants (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id     uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    granted_by  uuid NOT NULL REFERENCES profiles(id),
    granted_at  timestamptz DEFAULT now()
);

ALTER TABLE test_attempt_grants ENABLE ROW LEVEL SECURITY;

-- Користувач бачить лише свої гранти
CREATE POLICY "user read own grants" ON test_attempt_grants
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Адміни/власники читають всі гранти
CREATE POLICY "admin read grants" ON test_attempt_grants
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','owner','teacher','smm','manager')
    ));

-- Тільки адміни/власники/вчителі можуть надавати
CREATE POLICY "admin manage grants" ON test_attempt_grants
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','owner','teacher')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','owner','teacher')
    ));
