-- v69: branch_doc_blocks — manageable blocks for consumer info corner

CREATE TABLE IF NOT EXISTS public.branch_doc_blocks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number      INT NOT NULL,
    title       TEXT NOT NULL,
    dept        TEXT,
    order_index INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.branch_doc_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocks_read" ON public.branch_doc_blocks;
DROP POLICY IF EXISTS "blocks_admin" ON public.branch_doc_blocks;

CREATE POLICY "blocks_read"  ON public.branch_doc_blocks FOR SELECT USING (true);
CREATE POLICY "blocks_admin" ON public.branch_doc_blocks FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner','admin'))
);

-- Seed initial 12 blocks
INSERT INTO public.branch_doc_blocks (number, title, dept, order_index) VALUES
(1,  'Інформація для споживачів яка надається відповідно до ст. 7 ЗУ «Про фінансові послуги»', 'юридичний відділ', 1),
(2,  'Інформація про відокремлений підрозділ', NULL, 2),
(3,  'Виписка з Єдиного державного реєстру підприємств та організацій України', NULL, 3),
(4,  'Витяг з Державного реєстру фінансових установ, виданий Департаментом ліцензування НБУ (юридичної особи)', NULL, 4),
(5,  'Закон України «Про захист прав споживачів»', NULL, 5),
(6,  'Зображення та інформація про встановлені в Україні проби для виробів з дорогоцінних металів (Методика оцінки)', NULL, 6),
(7,  'Перелік послуг, що надаються фінансовою установою, порядок та умови їх надання', NULL, 7),
(8,  'ВИТЯГ З НАКАЗУ про заборону здійснення операцій з клієнтами, предметом забезпечення яких є товари подвійного використання', NULL, 8),
(9,  'ІНФОРМАЦІЯ ДЛЯ СПОЖИВАЧА щодо взаємодії при врегулюванні простроченої заборгованості', NULL, 9),
(10, 'Перелік осіб захищеної категорії', NULL, 10),
(11, 'Перелік документів на підставі яких надається пільга за кредитними зобов''язаннями', NULL, 11),
(12, 'Вартість, ціна/тарифи, розмір плати (проценти) щодо фінансових послуг', 'служба технічної підтримки', 12)
ON CONFLICT DO NOTHING;
