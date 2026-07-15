-- Migration v152: admin comment when manually grading open-ended (text)
-- test answers — shown back to the student in the wrong-answers protocol.

ALTER TABLE attempt_answers
    ADD COLUMN IF NOT EXISTS review_comment text;
