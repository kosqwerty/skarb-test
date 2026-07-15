-- Migration v142: toggle to stretch a test's cover image to fill width instead of fitting it

ALTER TABLE tests
    ADD COLUMN IF NOT EXISTS stretch_cover_image boolean NOT NULL DEFAULT false;
