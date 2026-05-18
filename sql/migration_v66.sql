-- v66: news reactions
CREATE TABLE IF NOT EXISTS public.news_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    news_id UUID NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(news_id, user_id, emoji)
);

ALTER TABLE public.news_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reactions_select" ON public.news_reactions;
DROP POLICY IF EXISTS "reactions_insert" ON public.news_reactions;
DROP POLICY IF EXISTS "reactions_delete" ON public.news_reactions;

CREATE POLICY "reactions_select" ON public.news_reactions FOR SELECT USING (true);
CREATE POLICY "reactions_insert" ON public.news_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions_delete" ON public.news_reactions FOR DELETE USING (auth.uid() = user_id);
