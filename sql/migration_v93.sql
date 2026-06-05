-- v93: news_reads — відстеження прочитаних новин

CREATE TABLE IF NOT EXISTS news_reads (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    news_id    UUID NOT NULL REFERENCES news(id) ON DELETE CASCADE,
    read_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, news_id)
);

CREATE INDEX IF NOT EXISTS idx_news_reads_user ON news_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_news_reads_news  ON news_reads(news_id);

ALTER TABLE news_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "news_reads_select" ON news_reads
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "news_reads_insert" ON news_reads
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "news_reads_delete" ON news_reads
    FOR DELETE TO authenticated USING (user_id = auth.uid());
