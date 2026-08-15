-- Performance indexes for faster user data fetching
CREATE INDEX IF NOT EXISTS idx_post_logs_user_status_posted ON post_logs(user_id, status, posted_at);
CREATE INDEX IF NOT EXISTS idx_post_logs_conn_status ON post_logs(facebook_connection_id, status);
CREATE INDEX IF NOT EXISTS idx_scheduled_slots_persona_sched ON scheduled_slots(persona_id, scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_snapshots_post_id ON post_engagement_snapshots(post_id, snapshot_taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_personas_user_page ON ai_personas(user_id, page_connection_id);
CREATE INDEX IF NOT EXISTS idx_image_templates_user ON image_templates(user_id, created_at DESC);
