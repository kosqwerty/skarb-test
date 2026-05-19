-- v68: branch display docs — add display_block and dovirenost_id to resources

ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS display_block INT;
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS dovirenost_id UUID REFERENCES public.dovirenosti(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.resources.display_block IS 'Block number (1-12) for branch consumer info display. NULL = not a display doc.';
COMMENT ON COLUMN public.resources.dovirenost_id IS 'ТОВ filter via dovirenosti. NULL = all subdivisions.';

CREATE INDEX IF NOT EXISTS resources_display_block_idx ON public.resources(display_block) WHERE display_block IS NOT NULL;
CREATE INDEX IF NOT EXISTS resources_dovirenost_idx ON public.resources(dovirenost_id) WHERE dovirenost_id IS NOT NULL;
