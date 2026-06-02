-- v89: company_bday_messages — привітання з днем народження компанії
CREATE TABLE IF NOT EXISTS company_bday_messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message    TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
    year       INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE company_bday_messages ENABLE ROW LEVEL SECURITY;

-- Читати можуть всі авторизовані
CREATE POLICY "company_bday_messages_select" ON company_bday_messages
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Писати може тільки сам користувач
CREATE POLICY "company_bday_messages_insert" ON company_bday_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Видаляти тільки своє (або адмін через service role)
CREATE POLICY "company_bday_messages_delete" ON company_bday_messages
    FOR DELETE USING (auth.uid() = user_id);

-- Увімкнути Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE company_bday_messages;
это