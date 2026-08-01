ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS topic_generation_mode VARCHAR DEFAULT 'creative' NOT NULL;
