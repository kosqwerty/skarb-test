-- v52: image_url on survey_questions
ALTER TABLE public.survey_questions
    ADD COLUMN IF NOT EXISTS image_url text;
