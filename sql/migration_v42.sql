-- v42: add access_group_id to news table

ALTER TABLE news
    ADD COLUMN IF NOT EXISTS access_group_id UUID REFERENCES access_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_news_access_group ON news(access_group_id);
