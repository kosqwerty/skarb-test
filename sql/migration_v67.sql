-- v67: one reaction per user per news (was unique per emoji, now unique per user)

-- 1. Drop old constraints
ALTER TABLE public.news_reactions DROP CONSTRAINT IF EXISTS news_reactions_news_id_user_id_emoji_key;
ALTER TABLE public.news_reactions DROP CONSTRAINT IF EXISTS news_reactions_news_id_user_id_key;

-- 2. Remove duplicates — keep only the most recent reaction per user per news
DELETE FROM public.news_reactions
WHERE id NOT IN (
    SELECT DISTINCT ON (news_id, user_id) id
    FROM public.news_reactions
    ORDER BY news_id, user_id, created_at DESC
);

-- 3. Add new constraint
ALTER TABLE public.news_reactions ADD CONSTRAINT news_reactions_news_id_user_id_key UNIQUE (news_id, user_id);
