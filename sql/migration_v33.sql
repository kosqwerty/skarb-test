-- Image alignment per answer: 'left' (default) | 'above' | 'right'

ALTER TABLE public.answers
    ADD COLUMN IF NOT EXISTS image_align text DEFAULT 'left';

NOTIFY pgrst, 'reload schema';
