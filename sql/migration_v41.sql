-- v41: allow_skip flag on tests
ALTER TABLE tests ADD COLUMN IF NOT EXISTS allow_skip boolean DEFAULT false;
