-- v161: birthday_wishes — persist who already sent a birthday congratulation
-- to whom this year, so refreshing the dashboard (or opening another tab/
-- device) can't be used to spam the same person with duplicate wishes.
-- UNIQUE(sender_id, recipient_id, year) is the real guard — the DB itself
-- rejects a duplicate insert, not just client-side button-disable.

BEGIN;

CREATE TABLE IF NOT EXISTS public.birthday_wishes (
    id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    year         int  NOT NULL,
    message      text NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE(sender_id, recipient_id, year)
);

ALTER TABLE public.birthday_wishes ENABLE ROW LEVEL SECURITY;

-- Відправник бачить свої вже надіслані привітання (щоб знати, кого вже привітав)
DROP POLICY IF EXISTS "birthday_wishes: select own sent" ON public.birthday_wishes;
CREATE POLICY "birthday_wishes: select own sent" ON public.birthday_wishes
    FOR SELECT TO authenticated
    USING (sender_id = auth.uid());

-- Кожен може надіслати тільки від свого імені, і не собі
DROP POLICY IF EXISTS "birthday_wishes: insert own" ON public.birthday_wishes;
CREATE POLICY "birthday_wishes: insert own" ON public.birthday_wishes
    FOR INSERT TO authenticated
    WITH CHECK (sender_id = auth.uid() AND recipient_id <> auth.uid());

COMMIT;
