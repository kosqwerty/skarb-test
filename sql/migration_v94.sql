-- v94: add address and phone fields to schedule_locations

ALTER TABLE schedule_locations
    ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE schedule_locations
    ADD COLUMN IF NOT EXISTS phone TEXT;
