-- v182: Мережева видимість для кастомних сторінок (Collections)
-- Дозволяє позначити сторінку як доступну лише з довіреної мережі,
-- за аналогією з news.network_visibility.

ALTER TABLE custom_pages
    ADD COLUMN IF NOT EXISTS network_visibility TEXT NOT NULL DEFAULT 'all'
    CHECK (network_visibility IN ('all', 'trusted'));
