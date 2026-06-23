-- Migration v127: extend intern_category CHECK constraint to include praktyka categories

-- Drop old 4-value constraint and add new 6-value one
ALTER TABLE public.tests DROP CONSTRAINT IF EXISTS tests_intern_category_check;

ALTER TABLE public.tests
    ADD CONSTRAINT tests_intern_category_check
        CHECK (intern_category IN (
            'техніка',
            'оцінка_техніки',
            'магазин',
            'драг_метали',
            'оцінка_драг_метали',
            'загальний'
        ));
