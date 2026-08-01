-- Migration 22: Add caption + full-text search to media_library and template_background_assets
-- Strategy: v1 fallback — auto-generated caption TEXT column + GENERATED ALWAYS tsvector + GIN index.
-- No pgvector extension needed. Upgrade to vector embeddings later with migration 23.

-- media_library
ALTER TABLE media_library
    ADD COLUMN IF NOT EXISTS caption TEXT;

ALTER TABLE media_library
    ADD COLUMN IF NOT EXISTS caption_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', COALESCE(caption, ''))) STORED;

CREATE INDEX IF NOT EXISTS media_library_caption_tsv_idx
    ON media_library USING GIN (caption_tsv);

-- template_background_assets
ALTER TABLE template_background_assets
    ADD COLUMN IF NOT EXISTS caption TEXT;

ALTER TABLE template_background_assets
    ADD COLUMN IF NOT EXISTS caption_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', COALESCE(caption, ''))) STORED;

CREATE INDEX IF NOT EXISTS template_bg_caption_tsv_idx
    ON template_background_assets USING GIN (caption_tsv);
