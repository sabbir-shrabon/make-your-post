CREATE TABLE background_assets (
	id SERIAL NOT NULL, 
	name VARCHAR, 
	url TEXT, 
	PRIMARY KEY (id)
);

CREATE TABLE font_assets (
	id SERIAL NOT NULL, 
	name VARCHAR, 
	url TEXT, 
	PRIMARY KEY (id)
);

CREATE TABLE media_library (
	id UUID NOT NULL, 
	user_id INTEGER NOT NULL, 
	persona_id INTEGER, 
	image_url TEXT NOT NULL, 
	storage_path TEXT NOT NULL, 
	generation_prompt TEXT, 
	provider VARCHAR, 
	model_name VARCHAR, 
	caption TEXT, 
	is_used BOOLEAN NOT NULL, 
	used_in_post_id INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(persona_id) REFERENCES ai_personas (id) ON DELETE SET NULL, 
	FOREIGN KEY(used_in_post_id) REFERENCES post_logs (id) ON DELETE SET NULL
);

CREATE TABLE oauth_states (
	id VARCHAR NOT NULL, 
	user_id INTEGER NOT NULL, 
	state VARCHAR NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE pending_facebook_oauth (
	user_id SERIAL NOT NULL, 
	pages JSON NOT NULL, 
	token_expires_at TIMESTAMP WITH TIME ZONE, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (user_id)
);

CREATE TABLE persona_image_settings (
	id SERIAL NOT NULL, 
	logo_url TEXT, 
	image_template_id UUID, 
	PRIMARY KEY (id)
);

CREATE TABLE post_logs (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	facebook_connection_id INTEGER, 
	ai_persona_id INTEGER, 
	content TEXT NOT NULL, 
	status VARCHAR NOT NULL, 
	media_urls JSON NOT NULL, 
	media_library_id UUID, 
	link_url TEXT, 
	link_preview_data JSON, 
	scheduled_at TIMESTAMP WITH TIME ZONE, 
	qstash_message_id VARCHAR, 
	delivery_status VARCHAR NOT NULL, 
	facebook_post_id VARCHAR, 
	facebook_post_url TEXT, 
	retry_count INTEGER NOT NULL, 
	topic TEXT, 
	image_url TEXT, 
	error_message TEXT, 
	publish_error TEXT, 
	ai_generated BOOLEAN NOT NULL, 
	auto_generated BOOLEAN NOT NULL, 
	posted_at TIMESTAMP WITH TIME ZONE, 
	published_at TIMESTAMP WITH TIME ZONE, 
	post_date DATE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(facebook_connection_id) REFERENCES facebook_connections (id) ON DELETE SET NULL, 
	FOREIGN KEY(ai_persona_id) REFERENCES ai_personas (id), 
	FOREIGN KEY(media_library_id) REFERENCES media_library (id) ON DELETE SET NULL
);

CREATE TABLE posts (
	id SERIAL NOT NULL, 
	status VARCHAR, 
	published_at TIMESTAMP WITH TIME ZONE, 
	facebook_post_id VARCHAR, 
	facebook_post_url VARCHAR, 
	publish_error TEXT, 
	PRIMARY KEY (id)
);

CREATE TABLE scheduled_posts (
	id SERIAL NOT NULL, 
	qstash_message_id VARCHAR, 
	delivery_status VARCHAR, 
	is_recurring BOOLEAN, 
	recurrence_rule VARCHAR, 
	retry_count INTEGER, 
	PRIMARY KEY (id)
);

CREATE TABLE users (
	id SERIAL NOT NULL, 
	email VARCHAR NOT NULL, 
	hashed_password VARCHAR NOT NULL, 
	name VARCHAR NOT NULL, 
	email_verified BOOLEAN NOT NULL, 
	timezone VARCHAR NOT NULL, 
	plan VARCHAR NOT NULL, 
	brand_logo_url TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE analytics_snapshots (
	id SERIAL NOT NULL, 
	post_id INTEGER NOT NULL, 
	likes_count INTEGER NOT NULL, 
	comments_count INTEGER NOT NULL, 
	shares_count INTEGER NOT NULL, 
	snapshot_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(post_id) REFERENCES post_logs (id)
);

CREATE TABLE brand_dna (
	id UUID NOT NULL, 
	user_id INTEGER NOT NULL, 
	source_count INTEGER NOT NULL, 
	dna_json JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE brand_profiles (
	id UUID NOT NULL, 
	user_id INTEGER NOT NULL, 
	brand_name VARCHAR, 
	primary_color_hex VARCHAR, 
	secondary_color_hex VARCHAR, 
	tone VARCHAR, 
	logo_url TEXT, 
	brand_json JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE dashboard_suggestions (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	suggestion_text TEXT NOT NULL, 
	action_type VARCHAR NOT NULL, 
	action_data JSON NOT NULL, 
	priority INTEGER NOT NULL, 
	is_dismissed BOOLEAN NOT NULL, 
	generated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE facebook_connections (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	page_id VARCHAR NOT NULL, 
	page_name VARCHAR NOT NULL, 
	page_picture_url TEXT, 
	page_access_token TEXT, 
	app_id VARCHAR, 
	app_secret TEXT, 
	instagram_business_account_id VARCHAR, 
	long_lived_user_token TEXT NOT NULL, 
	token_expires_at TIMESTAMP WITH TIME ZONE, 
	connection_status VARCHAR NOT NULL, 
	disconnected_at TIMESTAMP WITH TIME ZONE, 
	reconnect_count INTEGER NOT NULL, 
	last_token_refresh TIMESTAMP WITH TIME ZONE, 
	connected_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE image_templates (
	id UUID NOT NULL, 
	user_id INTEGER NOT NULL, 
	name VARCHAR NOT NULL, 
	reference_image_url TEXT NOT NULL, 
	template_json JSON NOT NULL, 
	canvas_width INTEGER NOT NULL, 
	canvas_height INTEGER NOT NULL, 
	aspect_ratio VARCHAR NOT NULL, 
	creation_method VARCHAR NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE model_settings (
	id UUID NOT NULL, 
	user_id INTEGER NOT NULL, 
	task_category VARCHAR NOT NULL, 
	provider_name VARCHAR NOT NULL, 
	model_name VARCHAR NOT NULL, 
	api_key_encrypted TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE schedules (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	niche TEXT NOT NULL, 
	post_time VARCHAR NOT NULL, 
	timezone VARCHAR NOT NULL, 
	active BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE style_analyses (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	source_type VARCHAR NOT NULL, 
	source_identifier TEXT NOT NULL, 
	page_name VARCHAR, 
	report JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE template_background_assets (
	id UUID NOT NULL, 
	user_id INTEGER NOT NULL, 
	type VARCHAR NOT NULL, 
	label VARCHAR, 
	caption TEXT, 
	preview_url TEXT, 
	config JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE template_font_assets (
	id UUID NOT NULL, 
	user_id INTEGER NOT NULL, 
	display_name VARCHAR NOT NULL, 
	font_file_url TEXT NOT NULL, 
	weight VARCHAR NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE tracked_pages (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	page_identifier TEXT NOT NULL, 
	page_name VARCHAR, 
	nickname VARCHAR NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	last_checked_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE tracker_trends (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	topic VARCHAR NOT NULL, 
	summary TEXT NOT NULL, 
	page_count INTEGER NOT NULL, 
	generated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	is_dismissed BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE user_settings (
	user_id INTEGER NOT NULL, 
	post_generation_provider VARCHAR NOT NULL, 
	post_generation_model VARCHAR NOT NULL, 
	image_generation_provider VARCHAR NOT NULL, 
	image_generation_model VARCHAR NOT NULL, 
	timezone VARCHAR NOT NULL, 
	PRIMARY KEY (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE ai_personas (
	id SERIAL NOT NULL, 
	page_connection_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	persona_name VARCHAR NOT NULL, 
	niche TEXT NOT NULL, 
	tone_tags TEXT NOT NULL, 
	custom_instructions TEXT, 
	prompt_config JSON, 
	custom_prompt TEXT, 
	creativity_level INTEGER NOT NULL, 
	language VARCHAR NOT NULL, 
	hashtags_enabled BOOLEAN NOT NULL, 
	hashtag_count INTEGER NOT NULL, 
	always_include_engagement_hook BOOLEAN NOT NULL, 
	assigned_days VARCHAR NOT NULL, 
	posting_time_slots JSON NOT NULL, 
	priority_level VARCHAR NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	topic_generation_mode VARCHAR NOT NULL, 
	learning_mode_enabled BOOLEAN NOT NULL, 
	minimum_engagement_threshold NUMERIC(10, 4) NOT NULL, 
	learned_patterns_summary TEXT, 
	brand_palette_id VARCHAR, 
	brand_font_pair_id VARCHAR, 
	performance_score NUMERIC(8, 4) NOT NULL, 
	total_posts_published INTEGER NOT NULL, 
	total_likes_received INTEGER NOT NULL, 
	total_comments_received INTEGER NOT NULL, 
	total_shares_received INTEGER NOT NULL, 
	total_reach_received INTEGER NOT NULL, 
	last_performance_update_at TIMESTAMP WITH TIME ZONE, 
	last_auto_post_at TIMESTAMP WITH TIME ZONE, 
	consecutive_failures INTEGER NOT NULL, 
	include_image BOOLEAN NOT NULL, 
	image_frequency VARCHAR NOT NULL, 
	image_prompt_source VARCHAR NOT NULL, 
	image_fallback_policy VARCHAR NOT NULL, 
	image_max_wait_seconds INTEGER NOT NULL, 
	template_image_generation_enabled BOOLEAN NOT NULL, 
	template_logo_url TEXT, 
	candidate_count INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(page_connection_id) REFERENCES facebook_connections (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE ai_recommendations (
	id SERIAL NOT NULL, 
	page_connection_id INTEGER NOT NULL, 
	recommendation_text TEXT NOT NULL, 
	generated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	is_dismissed BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(page_connection_id) REFERENCES facebook_connections (id)
);

CREATE TABLE post_image_generations (
	id UUID NOT NULL, 
	post_id INTEGER NOT NULL, 
	template_id UUID NOT NULL, 
	background_generation_prompt TEXT, 
	overlay_texts JSON NOT NULL, 
	llm_instructions JSON NOT NULL, 
	background_image_url TEXT, 
	logo_url TEXT, 
	final_image_url TEXT, 
	layer_overrides JSON NOT NULL, 
	status VARCHAR NOT NULL, 
	error_message TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(post_id) REFERENCES post_logs (id) ON DELETE CASCADE, 
	FOREIGN KEY(template_id) REFERENCES image_templates (id) ON DELETE CASCADE
);

CREATE TABLE tracked_page_posts (
	id SERIAL NOT NULL, 
	tracked_page_id INTEGER NOT NULL, 
	facebook_post_id VARCHAR NOT NULL, 
	content TEXT NOT NULL, 
	posted_at TIMESTAMP WITH TIME ZONE, 
	likes_count INTEGER NOT NULL, 
	comments_count INTEGER NOT NULL, 
	shares_count INTEGER NOT NULL, 
	engagement_score NUMERIC(10, 4) NOT NULL, 
	topic VARCHAR, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(tracked_page_id) REFERENCES tracked_pages (id)
);

CREATE TABLE image_generation_jobs (
	id UUID NOT NULL, 
	user_id INTEGER NOT NULL, 
	persona_id INTEGER, 
	status VARCHAR NOT NULL, 
	provider VARCHAR NOT NULL, 
	model_name VARCHAR NOT NULL, 
	assembled_prompt TEXT NOT NULL, 
	negative_prompt TEXT, 
	aspect_ratio VARCHAR NOT NULL, 
	result_image_url TEXT, 
	supabase_storage_path TEXT, 
	error_message TEXT, 
	max_wait_seconds INTEGER NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	completed_at TIMESTAMP WITH TIME ZONE, 
	generation_seconds INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(persona_id) REFERENCES ai_personas (id) ON DELETE SET NULL
);

CREATE TABLE image_prompt_settings (
	id UUID NOT NULL, 
	persona_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	subject_description TEXT, 
	style_tags JSON, 
	mood_tags JSON, 
	color_palette VARCHAR, 
	negative_prompt TEXT, 
	aspect_ratio VARCHAR NOT NULL, 
	text_overlay_enabled BOOLEAN NOT NULL, 
	text_overlay_content TEXT, 
	text_overlay_style VARCHAR, 
	reference_image_descriptors TEXT, 
	assembled_prompt TEXT, 
	reference_image_url TEXT, 
	template_layers_json JSON, 
	template_analyzed_at TIMESTAMP WITH TIME ZONE, 
	template_logo_url TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (persona_id), 
	FOREIGN KEY(persona_id) REFERENCES ai_personas (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE learned_strategy (
	id SERIAL NOT NULL, 
	persona_id INTEGER NOT NULL, 
	strategy_data JSON NOT NULL, 
	suggested_prompt TEXT, 
	confidence_score NUMERIC(5, 4) NOT NULL, 
	week_start_date DATE NOT NULL, 
	applied_to_prompt BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(persona_id) REFERENCES ai_personas (id)
);

CREATE TABLE learning_signals (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	persona_id INTEGER, 
	signal_type VARCHAR NOT NULL, 
	signal_data JSON NOT NULL, 
	outcome_score NUMERIC(10, 4) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(persona_id) REFERENCES ai_personas (id)
);

CREATE TABLE persona_image_template_assignments (
	persona_id INTEGER NOT NULL, 
	image_template_id UUID NOT NULL, 
	assigned_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (persona_id), 
	FOREIGN KEY(persona_id) REFERENCES ai_personas (id) ON DELETE CASCADE, 
	FOREIGN KEY(image_template_id) REFERENCES image_templates (id) ON DELETE CASCADE
);

CREATE TABLE persona_learning_patterns (
	id SERIAL NOT NULL, 
	persona_id INTEGER NOT NULL, 
	page_connection_id INTEGER NOT NULL, 
	pattern_type VARCHAR NOT NULL, 
	pattern_value TEXT NOT NULL, 
	average_engagement_score NUMERIC(10, 4) NOT NULL, 
	sample_size_count INTEGER NOT NULL, 
	last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(persona_id) REFERENCES ai_personas (id), 
	FOREIGN KEY(page_connection_id) REFERENCES facebook_connections (id)
);

CREATE TABLE persona_schedules (
	id UUID NOT NULL, 
	persona_id INTEGER NOT NULL, 
	timezone VARCHAR NOT NULL, 
	active_days JSON NOT NULL, 
	default_times JSON NOT NULL, 
	day_overrides JSON NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(persona_id) REFERENCES ai_personas (id) ON DELETE CASCADE
);

CREATE TABLE post_engagement_snapshots (
	id SERIAL NOT NULL, 
	post_id INTEGER NOT NULL, 
	persona_id INTEGER, 
	page_connection_id INTEGER NOT NULL, 
	snapshot_taken_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	snapshot_type VARCHAR NOT NULL, 
	likes_count INTEGER NOT NULL, 
	comments_count INTEGER NOT NULL, 
	shares_count INTEGER NOT NULL, 
	reach_count INTEGER NOT NULL, 
	engagement_score NUMERIC(10, 4) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(post_id) REFERENCES post_logs (id), 
	FOREIGN KEY(persona_id) REFERENCES ai_personas (id), 
	FOREIGN KEY(page_connection_id) REFERENCES facebook_connections (id)
);

CREATE TABLE post_image_assets (
	id UUID NOT NULL, 
	post_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	persona_id INTEGER, 
	background_image_url TEXT, 
	subject_image_url TEXT, 
	assets_json JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(post_id) REFERENCES post_logs (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(persona_id) REFERENCES ai_personas (id) ON DELETE SET NULL
);

CREATE TABLE prompt_templates (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	persona_id INTEGER NOT NULL, 
	template_name VARCHAR NOT NULL, 
	question_answers JSON NOT NULL, 
	assembled_prompt TEXT, 
	raw_prompt TEXT, 
	creativity_level INTEGER NOT NULL, 
	style_examples JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(persona_id) REFERENCES ai_personas (id)
);

CREATE TABLE scheduled_slots (
	id UUID NOT NULL, 
	persona_id INTEGER NOT NULL, 
	scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	qstash_message_id VARCHAR, 
	status VARCHAR NOT NULL, 
	post_id INTEGER, 
	error_message TEXT, 
	retry_count INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(persona_id) REFERENCES ai_personas (id) ON DELETE CASCADE, 
	FOREIGN KEY(post_id) REFERENCES post_logs (id) ON DELETE SET NULL
);

