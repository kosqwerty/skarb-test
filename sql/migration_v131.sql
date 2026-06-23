-- Migration v131: add node_type to schedule_locations

ALTER TABLE public.schedule_locations
    ADD COLUMN IF NOT EXISTS node_type text;

-- Drop old constraint if exists (re-run safe)
ALTER TABLE public.schedule_locations
    DROP CONSTRAINT IF EXISTS schedule_locations_node_type_check;

ALTER TABLE public.schedule_locations
    ADD CONSTRAINT schedule_locations_node_type_check
    CHECK (node_type IN ('universal', 'technical', 'gold', 'universal_seller', 'technical_seller'));
