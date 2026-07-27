-- v162: test_groups.stretch_cover_image — той самий перемикач "Розтягнути",
-- що вже є для окремих тестів (tests.stretch_cover_image), тепер і для груп тестів.

BEGIN;

ALTER TABLE public.test_groups ADD COLUMN IF NOT EXISTS stretch_cover_image boolean NOT NULL DEFAULT false;

COMMIT;
