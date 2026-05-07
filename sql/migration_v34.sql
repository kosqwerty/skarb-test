-- v34: navigation, feedback and protocol flags on tests
ALTER TABLE tests ADD COLUMN IF NOT EXISTS allow_back_navigation boolean DEFAULT false;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS allow_restart boolean DEFAULT false;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS show_answer_feedback boolean DEFAULT false;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS show_wrong_answers boolean DEFAULT false;
