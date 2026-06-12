-- ================================================================
-- LMS Migration v105 — resources.display_block: INT → TEXT
-- Причина: branch-docs використовував числові значення (1-12),
--          red-folder header потребує рядка 'rf-top'.
--          Конвертуємо існуючі числа в рядки (сумісно).
-- ================================================================

ALTER TABLE public.resources
    ALTER COLUMN display_block TYPE TEXT USING display_block::TEXT;

COMMENT ON COLUMN public.resources.display_block IS
    'Block key for special display areas. Branch-docs: numeric string (1-12). Red-folder header: ''rf-top''. NULL = regular resource.';

NOTIFY pgrst, 'reload schema';
