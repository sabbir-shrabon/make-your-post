# Database Architecture

This document explains how the database works in **Auto Poster AI** — a Facebook post automation system with AI-powered content generation, scheduling, image creation, and learning-based optimization.

---

## 1. Technology Stack

| Component           | Choice                                                                 |
|---------------------|------------------------------------------------------------------------|
| **Database**        | PostgreSQL (production). SQLite is explicitly blocked in production.   |
| **ORM**             | SQLAlchemy 2.0 with `Mapped`/`mapped_column` declarative style.        |
| **Migration**       | Custom SQL-based runner (no Alembic). Runs at application startup.     |
| **Connection Pool** | `NullPool` + `pool_pre_ping=True`, `pool_recycle=1800s`.               |
| **Async Strategy**  | Synchronous ORM wrapped in `asyncio.to_thread` for async endpoints.    |
| **Token Security**  | Facebook access tokens encrypted via Fernet (AES-128) before storage.  |

**Key Files:**

| File                        | Purpose                                      |
|-----------------------------|----------------------------------------------|
| `backend/app/database.py`   | Engine, session factory, Base, migrations    |
| `backend/app/models.py`     | All 31 SQLAlchemy model classes              |
| `backend/app/config.py`     | DATABASE_URL normalization & validation      |
| `backend/app/crypto.py`     | Fernet-based token encryption/decryption     |
| `backend/app/main.py`       | SQL-file migration runner at startup         |
| `backend/migrations/*.sql`  | 20 SQL migration files                       |

---

## 2. Connection & Configuration

### 2.1 URL Normalization (`config.py:35-53`)

The raw `DATABASE_URL` environment variable is normalized before use:

- `postgres://` is rewritten to `postgresql+psycopg://` (adds the psycopg driver).
- For Supabase hosts, `sslmode=require` is automatically appended.

### 2.2 Validation (`config.py:56-68`)

- `DATABASE_URL` is **required** — the app raises `RuntimeError` if missing.
- SQLite is explicitly rejected: *"SQLite DATABASE_URL is not allowed for this app."*

### 2.3 Engine & Session (`database.py:33-34`)

```python
engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

Engine kwargs:
- `pool_pre_ping=True` — tests connections before use.
- `pool_recycle=1800` — recycles connections after 30 minutes.
- `pool_size=3`, `max_overflow=5` — small pool suited for a single-process app.
- `NullPool` — no persistent pool when behind Supabase PgBouncer (transaction mode).

For Supabase + PgBouncer, `prepare_threshold=None` is set to avoid prepared statement issues.

### 2.4 FastAPI Dependency (`database.py:548-553`)

```python
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

Every request that needs a database session uses `Depends(get_db)`. The session is closed after the response.

---

## 3. All Tables (31 Models)

The models are defined in `backend/app/models.py` (681 lines). Every model inherits from `Base` (`DeclarativeBase`).

### 3.1 Core User & Auth

| Table | Model | PK | Key Columns | Purpose |
|-------|-------|----|-------------|---------|
| `users` | `User` | `id (int)` | `email` (unique), `hashed_password`, `name`, `plan`, `timezone` | User accounts & auth |
| `oauth_states` | `OAuthState` | `id (str)` | `user_id`, `state`, `expires_at` | Database-backed OAuth nonce storage |
| `pending_facebook_oauth` | `PendingFacebookOAuth` | `user_id (int)` | `pages` (JSON), `token_expires_at` | Temp storage during FB OAuth flow |

### 3.2 Facebook Integration

| Table | Model | PK | Key Columns | Purpose |
|-------|-------|----|-------------|---------|
| `facebook_connections` | `FacebookConnection` | `id (int)` | `user_id` (FK), `page_id`, `page_access_token` (encrypted), `instagram_business_account_id`, `connection_status` | Stores connected Facebook pages. Tokens are encrypted via `crypto.py`. |

### 3.3 AI Personas

| Table | Model | PK | Key Columns | Purpose |
|-------|-------|----|-------------|---------|
| `ai_personas` | `AIPersona` | `id (int)` | `page_connection_id` (FK), `user_id` (FK), `persona_name`, `niche`, `tone_tags`, `custom_instructions`, `creativity_level`, `posting_time_slots` (JSON), `performance_score`, `include_image`, `image_frequency` | The core AI identity that generates posts. Each persona is tied to one Facebook page. |

### 3.4 Post Logs & Analytics

| Table | Model | PK | Key Columns | Purpose |
|-------|-------|----|-------------|---------|
| `post_logs` | `PostLog` | `id (int)` | `user_id` (FK), `facebook_connection_id` (FK), `ai_persona_id` (FK), `content`, `status`, `media_urls` (JSON), `scheduled_at`, `facebook_post_id`, `posted_at` | Every post ever created — drafts, scheduled, published, failed. Full audit trail. |
| `analytics_snapshots` | `AnalyticsSnapshot` | `id (int)` | `post_id` (FK), `likes_count`, `comments_count`, `shares_count`, `snapshot_at` | Legacy per-post analytics |
| `post_engagement_snapshots` | `PostEngagementSnapshot` | `id (int)` | `post_id` (FK), `persona_id` (FK), `page_connection_id` (FK), `likes/comments/shares/reach_count`, `engagement_score` | Granular engagement snapshots for learning system |

### 3.5 Scheduling

| Table | Model | PK | Key Columns | Purpose |
|-------|-------|----|-------------|---------|
| `schedules` | `Schedule` | `id (int)` | `user_id` (FK, unique), `niche`, `post_time` | Legacy user-level schedule |
| `persona_schedules` | `PersonaSchedule` | `id (uuid)` | `persona_id` (FK, unique), `active_days` (JSON), `default_times` (JSON), `day_overrides` (JSON) | Per-persona schedule with day-level overrides |
| `scheduled_slots` | `ScheduledSlot` | `id (uuid)` | `persona_id` (FK), `scheduled_at`, `status`, `post_id` (FK), `qstash_message_id`, `retry_count` | Individual time slots for publishing. Has composite index on `(status, scheduled_at)`. |
| `scheduled_posts` | `ScheduledPost` | `id (int)` | `qstash_message_id`, `delivery_status`, `is_recurring` | QStash integration posts |

### 3.6 Image Generation

| Table | Model | PK | Key Columns | Purpose |
|-------|-------|----|-------------|---------|
| `image_generation_jobs` | `ImageGenerationJob` | `id (uuid)` | `user_id` (FK), `persona_id` (FK), `status`, `provider`, `model_name`, `assembled_prompt`, `result_image_url`, `supabase_storage_path` | Tracks each AI image generation request end-to-end |
| `media_library` | `MediaLibrary` | `id (uuid)` | `user_id` (FK), `persona_id` (FK), `image_url`, `storage_path`, `generation_prompt`, `is_used`, `used_in_post_id` (FK) | Library of generated images, tracks usage in posts |
| `image_prompt_settings` | `ImagePromptSettings` | `id (uuid)` | `persona_id` (FK, unique), `subject_description`, `style_tags` (JSON), `mood_tags` (JSON), `negative_prompt`, `template_layers_json` (JSON) | Per-persona image generation prompt configuration |

### 3.7 Image Templates (Prompt Studio)

| Table | Model | PK | Key Columns | Purpose |
|-------|-------|----|-------------|---------|
| `image_templates` | `ImageTemplate` | `id (uuid)` | `user_id` (FK), `name`, `reference_image_url`, `template_json` (JSON), `canvas_width/height`, `aspect_ratio`, `creation_method` | Image composition templates |
| `template_background_assets` | `TemplateBackgroundAsset` | `id (uuid)` | `user_id` (FK), `type`, `label`, `preview_url`, `config` (JSON) | Reusable background presets (solid colors, gradients) |
| `template_font_assets` | `TemplateFontAsset` | `id (uuid)` | `user_id` (FK), `display_name`, `font_file_url`, `weight` | Reusable font assets |
| `persona_image_template_assignments` | `PersonaImageTemplateAssignment` | `persona_id (int)` | `persona_id` (FK, PK, unique), `image_template_id` (FK) | Links a persona to its image template |
| `post_image_generations` | `PostImageGeneration` | `id (uuid)` | `post_id` (FK, unique), `template_id` (FK), `background_generation_prompt`, `overlay_texts` (JSON), `final_image_url`, `status` | Tracks template-based image generation per post |
| `post_image_assets` | `PostImageAssets` | `id (uuid)` | `post_id` (FK, unique), `user_id` (FK), `persona_id` (FK), `background_image_url`, `subject_image_url`, `assets_json` (JSON) | Stores all image assets generated for a specific post |

### 3.8 Learning & Intelligence

| Table | Model | PK | Key Columns | Purpose |
|-------|-------|----|-------------|---------|
| `learning_signals` | `LearningSignal` | `id (int)` | `user_id` (FK), `persona_id` (FK), `signal_type`, `signal_data` (JSON), `outcome_score` | Raw engagement signal data collected from Facebook |
| `persona_learning_patterns` | `PersonaLearningPattern` | `id (int)` | `persona_id` (FK), `pattern_type`, `pattern_value`, `average_engagement_score`, `sample_size_count` | Aggregated patterns the system has learned (e.g. "posts with emojis at 9am perform +20%") |
| `learned_strategy` | `LearnedStrategy` | `id (int)` | `persona_id` (FK), `strategy_data` (JSON), `suggested_prompt`, `confidence_score`, `week_start_date`, `applied_to_prompt` | Weekly strategy recommendations generated by the learning engine |
| `ai_recommendations` | `AIRecommendation` | `id (int)` | `page_connection_id` (FK), `recommendation_text`, `is_dismissed` | AI-generated suggestions for the user |
| `dashboard_suggestions` | `DashboardSuggestion` | `id (int)` | `user_id` (FK), `suggestion_text`, `action_type`, `action_data` (JSON), `priority`, `is_dismissed` | Dashboard-level proactive suggestions |

### 3.9 Style Analysis & Page Tracking

| Table | Model | PK | Key Columns | Purpose |
|-------|-------|----|-------------|---------|
| `style_analyses` | `StyleAnalysis` | `id (int)` | `user_id` (FK), `source_type`, `source_identifier`, `report` (JSON) | AI analysis of competitor/industry pages' content style |
| `tracked_pages` | `TrackedPage` | `id (int)` | `user_id` (FK), `page_identifier`, `page_name`, `nickname`, `is_active` | Pages the user monitors for competitive intelligence |
| `tracked_page_posts` | `TrackedPagePost` | `id (int)` | `tracked_page_id` (FK), `facebook_post_id`, `content`, `likes/comments/shares_count`, `engagement_score`, `topic` | Individual posts from tracked pages |
| `tracker_trends` | `TrackerTrend` | `id (int)` | `user_id` (FK), `topic`, `summary`, `page_count`, `is_dismissed` | Cross-page trend summaries |

### 3.10 Brand & Identity

| Table | Model | PK | Key Columns | Purpose |
|-------|-------|----|-------------|---------|
| `brand_profiles` | `BrandProfile` | `id (uuid)` | `user_id` (FK, unique), `brand_name`, `primary_color_hex`, `secondary_color_hex`, `tone`, `logo_url`, `brand_json` (JSON) | User's brand identity profile |
| `brand_dna` | `BrandDNA` | `id (uuid)` | `user_id` (FK, unique), `source_count`, `dna_json` (JSON) | Extracted brand DNA from analysis of existing content |

### 3.11 Model Settings (BYOK)

| Table | Model | PK | Key Columns | Purpose |
|-------|-------|----|-------------|---------|
| `model_settings` | `ModelSettings` | `id (uuid)` | `user_id` (FK), `task_category`, `provider_name`, `model_name`, `api_key_encrypted` | User-provided API keys for custom AI models |
| `user_settings` | `UserSettings` | `user_id (int)` | `post_generation_provider`, `post_generation_model`, `image_generation_provider`, `image_generation_model`, `timezone` | User-level AI model preferences |

### 3.12 Legacy Tables (no active use)

| Table | Model | Purpose |
|-------|-------|---------|
| `posts` | `Post` | Minimal post tracking (superseded by `post_logs`) |
| `persona_image_settings` | `PersonaImageSetting` | Legacy image settings (superseded by `image_prompt_settings`) |
| `background_assets` | `BackgroundAsset` | Legacy (superseded by `template_background_assets`) |
| `font_assets` | `FontAsset` | Legacy (superseded by `template_font_assets`) |
| `prompt_templates` | `PromptTemplate` | Prompt templates (still defined but usage uncertain) |

---

## 4. Entity Relationship Summary

The central hub of the database is **`users`**. Nearly every table has a `user_id` foreign key pointing back to it.

### Users → Everything
```
users.id → facebook_connections.user_id
         → schedules.user_id
         → post_logs.user_id
         → ai_personas.user_id
         → user_settings.user_id (CASCADE)
         → model_settings.user_id (CASCADE)
         → image_generation_jobs.user_id (CASCADE)
         → media_library.user_id (CASCADE)
         → image_prompt_settings.user_id (CASCADE)
         → image_templates.user_id (CASCADE)
         → brand_profiles.user_id (CASCADE, unique)
         → brand_dna.user_id (CASCADE, unique)
         → tracked_pages.user_id
         → dashboard_suggestions.user_id
         → learning_signals.user_id
```

### Post → Everything (Analytics, Images)
```
post_logs.id → analytics_snapshots.post_id
             → post_engagement_snapshots.post_id
             → post_image_generations.post_id (CASCADE, unique)
             → post_image_assets.post_id (CASCADE, unique)
             → media_library.used_in_post_id (SET NULL)
             → scheduled_slots.post_id (SET NULL)
```

### Persona → Everything (Scheduling, Learning, Images)
```
ai_personas.id → persona_schedules.persona_id (CASCADE, unique)
               → persona_learning_patterns.persona_id
               → learned_strategy.persona_id
               → image_prompt_settings.persona_id (CASCADE, unique)
               → persona_image_template_assignments.persona_id (CASCADE, PK)
               → image_generation_jobs.persona_id (SET NULL)
               → media_library.persona_id (SET NULL)
               → scheduled_slots.persona_id (CASCADE)
```

### Delete Cascades
- `CASCADE` is used on critical child tables: user_settings, brand_profiles, image_templates, persona_schedules, post_image_generations, post_image_assets, etc.
- `SET NULL` is used for optional references: facebook_connection_id on post_logs, persona_id on image_generation_jobs, used_in_post_id on media_library.

---

## 5. Migration System

The app has a **dual migration system** — both run at startup.

### 5.1 Programmatic Migrations (`database.py:41-68`)

Runs after `Base.metadata.create_all()` and applies schema changes via `ALTER TABLE`:

| Function | Lines | What it does |
|----------|-------|-------------|
| `create_database_tables()` | 41-68 | Entry point — calls all the functions below |
| `_ensure_facebook_credential_columns()` | 108-128 | Adds `app_id`, `app_secret` to `facebook_connections` |
| `_ensure_facebook_connection_flow()` | 150-248 | Adds `connection_status`, `disconnected_at`, `reconnect_count`, `last_token_refresh`; manages FK constraints for connection lifecycle |
| `_ensure_post_logs_publish_tracking()` | 71-78 | Adds `facebook_post_url`, `published_at`, `publish_error` to `post_logs` |
| `_ensure_product_blueprint_columns()` | 251-336 | Adds ~40 columns across 8 tables (users, facebook_connections, ai_personas, post_logs, tracked_pages, image_templates, image_prompt_settings, prompt_templates, post_image_generations) |
| `_ensure_user_settings_table()` | 339-381 | Creates `user_settings` table if missing, adds FK |
| `_migrate_ai_page_settings_to_personas()` | 384-484 | Migrates data from legacy `ai_page_settings` to `ai_personas`; adds columns to `post_logs` and `ai_personas` |
| `_ensure_background_asset_schema()` | 487-545 | Renames `asset_type`→`type`, `value_json`→`config` on `template_background_assets`; migrates config data from legacy to new format |

**Helper function** `_add_missing_columns()` (`database.py:131-148`):
- Uses `SQLAlchemy inspect()` to check which columns exist.
- Only executes `ALTER TABLE ADD COLUMN` for missing columns.
- Idempotent — safe to run on every startup.

### 5.2 SQL File Migrations (`main.py:121-225`)

Runs at application startup after `create_database_tables()`. Tracks applied migrations in a `schema_migrations` table.

**Migration tracking table** (`main.py:181-190`):
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

**How it works:**
1. Gets the list of migration files (hardcoded order in `main.py:162-178`).
2. For each file, checks if already applied via SELECT in `schema_migrations`.
3. If not applied, reads the `.sql` file, splits statements (respecting quotes and dollar-quoting), executes each, then inserts a record.

**Current migration files (20 total):**

| File | Purpose |
|------|---------|
| `01.sql` | Base tables (users, facebook_connections, schedules, post_logs) |
| `02 add_image_generation_tables.sql` | Model settings, image generation jobs, media library, image prompt settings; image columns on personas |
| `03-05 add_manual_template_builder_step*.sql` | Manual template builder (3 parts) |
| `06 add_media_library_id_to_post_logs.sql` | Media library FK in post_logs |
| `07 add_sessions_table.sql` | Sessions table |
| `08 add_template_image_generation.sql` | Template image generation tables |
| `09 add_user_settings_models.sql` | User settings & model settings |
| `10 fix_facebook_connections_flow.sql` | Facebook connection flow fixes |
| `11 fix_image_templates_schema.sql` | Image templates schema fix |
| `12 rebuild_image_templates_system.sql` | Rebuild image template system |
| `13 drop_layers_json_column.sql` | Drop legacy layers_json column |
| `14 add_updated_at_to_image_templates.sql` | Add updated_at |
| `15 add_qstash_fields_to_post_logs.sql` | QStash message ID & delivery_status |
| `16 health_check_fixes.sql` | Health check schema fixes |
| `17 repair_persona_save_and_scheduling_schema.sql` | Persona save/scheduling fixes |
| `18 fix_scheduled_slots_post_id_fk.sql` | Fix FK on scheduled_slots |
| `19 drop_legacy_persona_schedule_columns.sql` | Cleanup legacy columns |
| `20_expand_background_assets.sql` | Expand background assets |

**Important design note:** The migration order in `main.py` is NOT sequential by number. The array at lines 162-178 defines a specific execution order that handles inter-migration dependencies.

---

## 6. Token Encryption (`crypto.py`)

Facebook `page_access_token` and `long_lived_user_token` are encrypted before storage.

```python
def encrypt_token(token: str) -> str:
    return _fernet().encrypt(token.encode("utf-8")).decode("utf-8")

def decrypt_token(encrypted_token: str) -> str | None:
    return _fernet().decrypt(encrypted_token.encode("utf-8")).decode("utf-8")
```

- Uses **Fernet** (symmetric AES-128 encryption with HMAC authentication).
- The key is derived via `SHA-256` of `FACEBOOK_TOKEN_ENCRYPTION_KEY` or (fallback) `SECRET_KEY`.
- If the key changes between encryption and decryption, decryption fails gracefully and returns `None`.

---

## 7. CRUD Operations (Business Logic)

### 7.1 User Management
- **Registration** (`main.py:581-601`): Creates `User` with bcrypt-hashed password via `auth.py`.
- **Login** (`main.py:604-619`): Queries user by email, verifies password, returns JWT.
- **Auth guard** (`auth.py:103-124`): `get_current_user()` decodes JWT, fetches user from DB on every protected route.

### 7.2 Posts
- **Create draft** (`posts.py:320-335`): Creates `PostLog` with `status="draft"`.
- **Publish to Facebook** (`posts.py:521-592`): Creates `PostLog` with `status="publishing"`, calls Facebook Graph API, updates `facebook_post_id`, `facebook_post_url`, `status` on success or error.
- **Schedule** (`posts.py`): Creates `PostLog` with `scheduled_at` set.
- **Scheduled post runner** (`posts.py:657-735`): Queries `post_logs` where `scheduled_at <= now()` and `status="scheduled"`, publishes via Facebook, updates status.

### 7.3 Persona Scheduling Flow

1. **Register slots** (`schedule_service.py:register_todays_slots()`): Reads `persona_schedules`, determines today's time slots, creates `ScheduledSlot` records.
2. **Pre-generation** (`slot_publish_service.py:prepare_slot_publish()`): Generates AI content and optionally images before the scheduled time (called ~30 min ahead by QStash).
3. **Execution** (`slot_publish_service.py:execute_slot_publish()`): At the scheduled time, publishes the pre-generated content to Facebook via `publish_flow.py:run_full_publish_flow()`.
4. **Post-publish**: Updates `post_logs` record with Facebook post ID, URL, status.

### 7.4 Image Generation
1. **Create job** (`images.py:210-262`): Creates `ImageGenerationJob` with `status="pending"`, calls the configured AI image provider.
2. **Poll/Webhook** (`images.py:264-322`): Updates `status`, `result_image_url`, `supabase_storage_path`.
3. **Store in library** (`images.py:375-406`): Creates `MediaLibrary` record when image is saved for reuse.
4. **Delete** (`images.py:408-442`): Removes from `media_library` and Supabase storage.

### 7.5 Learning Engine Flow
1. **Engagement snapshot** (`learning/service.py:run_engagement_snapshot_job()`): Calls Facebook Graph API for recent posts, stores `PostEngagementSnapshot`.
2. **Pattern extraction** (`learning/service.py:run_weekly_learning_job()`): Aggregates engagement data, identifies high/low performing patterns, stores `PersonaLearningPattern`.
3. **Strategy generation** (`learning/service.py`): Creates `LearnedStrategy` records with prompt suggestions.
4. **Cleanup** (`learning/service.py:delete_persona_dependencies()`): Deletes all learning data, image prompts, schedules, tracked pages when a persona is removed.

### 7.6 Image Template Builder
- **Default assets** (`persona_image_templates.py:488-564`): Creates 6 default background assets (Dark Navy, Deep Purple, Charcoal Black, Warm Cream, Ocean Blue, Sunset Glow) and 3 default font assets (Roboto Bold, Roboto Regular, Nirmala UI Regular) on first access.
- **CRUD** for backgrounds, fonts, templates, and persona-template assignments.

---

## 8. Connection Keepalive

A keepalive mechanism runs via APScheduler (`scheduler.py:13-27`):

```python
def keep_db_alive():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
```

This runs every 300 seconds to prevent connection drops from poolers or firewalls.

---

## 9. Error Handling Patterns

- **Startup tolerance**: Migration errors (especially statement timeouts) are caught and logged but do not prevent the app from starting. The app runs with a warning banner.
- **Constraint relaxation**: FK and NOT NULL constraints are dropped and recreated with error handling — if a constraint operation times out, the app continues.
- **Migration idempotency**: All `_add_missing_columns()` calls check column existence before ALTER. SQL file migrations check `schema_migrations` before applying.
- **Supabase DNS errors**: A specific error message guides the user to use the Transaction Pooler URL instead of the direct database host.

---

## 10. Seed Data

The app has no standalone seed script. Default data is created programmatically:

1. **Default template assets** are seeded when a user first opens the template builder (6 backgrounds, 3 fonts).
2. **User defaults** are applied via column defaults in models (e.g., `plan="free"`, `timezone="UTC"`, `creativity_level=7`).
3. **Legacy migration** (`_migrate_ai_page_settings_to_personas()`) copies data from `ai_page_settings` to `ai_personas` on first startup if the legacy table has data.
