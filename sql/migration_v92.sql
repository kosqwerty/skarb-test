-- v92: assistant_logs — логування запитів до AI помічника

CREATE TABLE IF NOT EXISTS assistant_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assistant_logs_user_date
    ON assistant_logs(user_id, created_at);

ALTER TABLE assistant_logs ENABLE ROW LEVEL SECURITY;

-- Користувач бачить тільки свої записи
CREATE POLICY "assistant_logs_select" ON assistant_logs
    FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Вставка через service role (Edge Function)
CREATE POLICY "assistant_logs_insert" ON assistant_logs
    FOR INSERT TO service_role WITH CHECK (true);

-- Адмін бачить всі
CREATE POLICY "assistant_logs_admin" ON assistant_logs
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','admin'))
    );
