-- Auto-assign flag: tests with this flag are automatically assigned to new employees
ALTER TABLE public.tests
    ADD COLUMN IF NOT EXISTS auto_assign boolean DEFAULT false;
