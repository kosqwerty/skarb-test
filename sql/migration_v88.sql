-- v88: registry_sections.description — текстовий опис розділу
ALTER TABLE registry_sections
    ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;
