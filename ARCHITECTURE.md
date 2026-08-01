# AutoPoster — Technical Architecture & Reference Guide

> Complete, concrete technical reference documentation for the AutoPoster AI social media automation platform. This document specifies exact file paths, Python module names, database tables, function signatures, composition algorithms, and lifecycle state machines across the entire system.

---

## 1. App Overview

AutoPoster is a multi-tenant social media content automation platform designed for agency owners, digital marketers, and brand managers to automatically generate, visually style, schedule, and publish Facebook posts paired with AI-generated composite posters. The core user journey begins when a user registers and authenticates via JWT auth (`backend/app/auth.py`), connects one or more managed Facebook Pages using an OAuth 2.0 popup flow (`backend/app/facebook_oauth.py`), and creates an AI Persona (`backend/app/models.py:AIPersona`) configured with niche instructions, tone tags, and visual style templates. The user defines recurring publishing schedules or prompt templates. On every schedule trigger, the platform executes a multi-stage background pipeline: LLM text generation (`backend/app/posts.py`), AI Art Director visual layout planning (`backend/app/services/art_director.py`), unified resource resolution for icons/emojis/photos (`backend/app/services/resource_resolver_unified.py`), deterministic composition layout validation (`backend/app/services/composition_validator.py`), zero-network Pillow/Cairo local canvas image rendering (`backend/app/services/poster_renderer.py`), and optional Vision Critic validation (`backend/app/services/vision_critic.py`). The final published post and companion poster image are delivered to Facebook via Graph API (`backend/app/posts.py:publish_post_to_facebook`), after which engagement metrics (likes, comments, shares, reach) are periodically polled to update persona performance scores and strategy learning models (`backend/app/learning/service.py`).

---

## 2. High-Level Architecture

### 2.1 Major Subsystems & Codebase Mapping

| Subsystem | Implementing Files / Modules | Primary Responsibilities |
|---|---|---|
| **Authentication & Users** | `backend/app/auth.py`<br>`backend/app/crypto.py`<br>`backend/app/models.py` | User registration, bcrypt password hashing, OAuth2 bearer JWT token issuing/decoding (`get_current_user`), Fernet token encryption at rest. |
| **Facebook OAuth & Integration** | `backend/app/facebook_oauth.py`<br>`backend/app/posts.py` | Facebook Graph API OAuth flow, token exchange, page selection, encrypted token storage, page status transitions, Facebook Graph API publishing (`publish_post_to_facebook`). |
| **Persona Management** | `backend/app/models.py` (`AIPersona`) <br>`backend/app/posts.py` | Brand kit management, niche & tone configuration, custom prompt assembly (`_persona_post_prompt`), post text generation (`generate_persona_post_with_user_model`). |
| **Prompt Studio** | `backend/app/routers/persona_image_templates.py`<br>`backend/app/models.py` | Visual template design, persona-template assignment (`PersonaImageTemplateAssignment`), prompt settings (`ImagePromptSettings`), template layer generation (`_run_post_image_generation`). |
| **Post Generation & Execution** | `backend/app/posts.py`<br>`backend/app/services/publish_flow.py` | Text generation dispatcher (`generate_post_text_for_user`), topic extraction (`extract_post_topic`), full publishing orchestration (`run_full_publish_flow`). |
| **Poster / Image Generation Pipeline** | `backend/app/services/art_director.py`<br>`backend/app/services/resource_resolver_unified.py`<br>`backend/app/services/resource_resolver.py`<br>`backend/app/services/cat_photo_resolver.py`<br>`backend/app/services/library_resolver.py`<br>`backend/app/services/composition_validator.py`<br>`backend/app/services/poster_renderer.py`<br>`backend/app/services/vision_critic.py`<br>`backend/app/services/poster_orchestrator.py`<br>`backend/app/providers/image_providers.py` | Generative poster design planning (`run_art_director`), multi-resource resolution (Iconify, Gemoji, Pexels, Cat API, Postgres tsvector search), layout safety and contrast auto-fixing (`validate_and_fix_composition`), PIL canvas rendering (`render_poster_to_base64`), visual critique (`run_vision_critic`), and external AI image generation dispatch (Fal.ai, Stability, DALL-E, Gemini). |
| **Scheduling & Auto-Posting** | `backend/app/scheduler.py`<br>`backend/app/services/schedule_service.py`<br>`backend/app/services/slot_publish_service.py`<br>`backend/app/routers/schedule_routes.py` | APScheduler (`AsyncIOScheduler`) in-process background worker, slot pre-registration (`register_todays_slots`), 30-min ahead pre-generation (`prepare_upcoming_persona_slots`), and exact-time execution (`process_due_persona_slots`, `execute_slot_publish`). |
| **Learning & Analytics** | `backend/app/learning/service.py`<br>`backend/app/mistral_service.py` | Facebook post engagement snapshot collector (`collect_due_engagement_snapshots`), performance score calculator (`recalculate_persona_performance`), pattern extraction (`update_persona_learning_patterns`), and weekly strategy synthesis (`run_weekly_learning_job`). |
| **Page Tracker & Competitor Analysis** | `backend/app/routers/brand_automation.py`<br>`backend/app/models.py` | Competitor page scraping/tracking (`TrackedPage`, `TrackedPagePost`), trend aggregation (`TrackerTrend`), and style analysis (`StyleAnalysis`). |

---

### 2.2 System Data Flow Diagram

```
+-----------------------------------------------------------------------------------+
|                                 Next.js SPA Frontend                              |
|         (components/social-platform.tsx, lib/api.ts via Axios interceptors)       |
+-----------------------------------------------------------------------------------+
                                          |
                                    HTTP / REST (JWT)
                                          v
+-----------------------------------------------------------------------------------+
|                                 FastAPI Backend App                               |
|       (main.py / routers: schedule_routes.py, images.py, persona_image_templates.py) |
+-----------------------------------------------------------------------------------+
        |                                 |                                 |
        v                                 v                                 v
+------------------+           +--------------------+            +--------------------+
|   APScheduler    |           | Publish / Poster   |            |   Learning Engine  |
|  (scheduler.py)  |           |    Orchestrator    |            | (learning/service.py)
+------------------+           +--------------------+            +--------------------+
        |                                 |                                 |
        | (Interval / Cron)               | (Art Director, Resolver,        | (Graph API Insights
        v                         Validator, PIL Renderer)                  v  Snapshot Polling)
+-----------------------------------------------------------------------------------+
|                              External AI & Cloud APIs                             |
|  - LLM Providers: OpenAI, Anthropic, Gemini, Mistral, OpenRouter                  |
|  - Image Gen Providers: Fal.ai, Stability AI, DALL-E, Gemini Imagen               |
|  - Asset APIs: Iconify (Icons), GitHub Gemoji (Emojis), Pexels, Cat API            |
|  - Facebook Graph API (Publishing, Insights, Pages)                               |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                              Database & Cloud Storage                             |
|  - PostgreSQL (Supabase pooler port 6543): 39 SQLAlchemy Tables                   |
|  - Supabase Storage Buckets: generated-images, image-templates                    |
+-----------------------------------------------------------------------------------+
```

---

## 3. Database Schema Summary

The database consists of **39 SQLAlchemy tables** defined in `backend/app/models.py`.

### 3.1 Subsystem Table Breakdown

#### 1. Auth & Core User Tables
* `users`: Primary user account record storing email, bcrypt hashed password, user role (`admin`/`user`), pricing plan (`free`/`pro`), timezone, and timestamps.
* `oauth_states`: Short-lived OAuth state tokens (10-min expiration) used during Facebook OAuth initialization to prevent CSRF attacks. Primary key `id` (state string), foreign key `user_id -> users.id`.
* `pending_facebook_oauth`: Temporary storage (15-min expiration) holding unselected Facebook Pages returned during OAuth token exchange. Foreign key `user_id -> users.id` (primary key).

#### 2. Facebook Connection Tables
* `facebook_connections`: Managed Facebook Page connections. Stores `page_id`, `page_name`, `page_picture_url`, Fernet-encrypted `page_access_token`, `connection_status` (`connected`/`disconnected`), `reconnect_count`, `connected_at`, `disconnected_at`, and `last_token_refresh`. Foreign key `user_id -> users.id`.

#### 3. AI Persona & Prompt Studio Tables
* `ai_personas`: Central entity representing a distinct content voice attached to a Facebook page. Stores `niche`, `tone_tags`, `custom_instructions`, `custom_prompt`, `creativity_level`, `language`, `hashtags_enabled`, `hashtag_count`, `always_include_engagement_hook`, `learning_mode_enabled`, `template_image_generation_enabled`, `image_frequency`, `image_fallback_policy`, `performance_score`, and cumulative metrics (`total_likes_received`, `total_comments_received`, etc.). Foreign keys: `user_id -> users.id`, `page_connection_id -> facebook_connections.id`.
* `persona_schedules`: **LIVE source of truth for recurring schedule rules.** Stores persona active days (`active_days` JSON list), default posting times (`default_times` JSON list), day-specific overrides (`day_overrides` JSON dict), `timezone`, and `is_active` status. Foreign key `persona_id -> ai_personas.id` (unique).
* `prompt_templates`: Saved structured prompt configurations containing `assembled_prompt`, `niche_override`, `tone_tags_override`, and `variables` JSON. Foreign keys: `user_id -> users.id`, `persona_id -> ai_personas.id`.
* `image_prompt_settings`: Legacy & prompt studio persona image prompt settings holding `assembled_prompt`, `template_layers_json`, `template_logo_url`, and `accent_color`. Foreign keys: `user_id -> users.id`, `persona_id -> ai_personas.id` (unique).
* `image_templates`: Reusable visual template designs containing `template_json` (layer positions, fonts, colors), preview image URLs, category, and public status. Foreign key `created_by_user_id -> users.id`.
* `template_background_assets`: Background images for visual templates with `preview_url`, `storage_path`, full-text search `caption` string, and `caption_tsv` tsvector index. Foreign key `uploaded_by_user_id -> users.id`.
* `template_font_assets`: Uploaded custom TTF/OTF font files storing `font_family`, `font_weight`, `font_style`, `file_url`, and `storage_path`. Foreign key `uploaded_by_user_id -> users.id`.
* `persona_image_template_assignments`: Explicit mapping assigning an `image_templates` record to an `ai_personas` record. Foreign keys: `persona_id -> ai_personas.id` (unique), `image_template_id -> image_templates.id`.

#### 4. Post Execution & Logging Tables
* `scheduled_slots`: **LIVE operational table for today's generated and upcoming slots.** Created daily from `persona_schedules`. Tracks `scheduled_at` timestamp, `status` (`pending`, `generating`, `generated`, `publishing`, `published`, `failed`, `missed`), `error_message`, and `post_id`. Foreign keys: `persona_id -> ai_personas.id`, `post_id -> post_logs.id`.
* `post_logs`: Execution log for every generated/published post. Stores `content`, `topic`, `image_url`, `media_library_id`, `status` (`draft`, `scheduled`, `publishing`, `published`, `failed`, `missed`, `paused`), `delivery_status` (`pending`, `delivering`, `delivered`, `failed`), `facebook_post_id`, `posted_at`, and `publish_error`. Foreign keys: `user_id -> users.id`, `facebook_connection_id -> facebook_connections.id`, `ai_persona_id -> ai_personas.id`.
* `post_image_generations`: History of Prompt Studio template image generation runs tracking layer decisions (`llm_instructions`), `status` (`pending`, `processing`, `completed`, `failed`), `final_image_url`, and `error_message`. Foreign keys: `post_id -> post_logs.id`, `user_id -> users.id`.
* `post_image_assets`: Intermediate resolved assets used in a specific `post_image_generations` run. Foreign key `generation_id -> post_image_generations.id`.
* `image_generation_jobs`: Legacy AI image generation job tracking. Foreign keys: `user_id -> users.id`, `post_log_id -> post_logs.id`.
* `media_library`: Storage registry for all generated or uploaded user images. Stores `image_url`, `storage_path`, `generation_prompt`, `provider`, `model_name`, `is_used`, `caption` text, and `caption_tsv` tsvector column. Foreign keys: `user_id -> users.id`, `persona_id -> ai_personas.id`.

#### 5. Model & User Settings Tables
* `model_settings`: Per-task-category provider and model overrides (`task_category`, `provider_name`, `model_name`, `api_key_encrypted`, `temperature`, `max_tokens`). Task categories include `post_generation`, `post_analysis`, `image_prompt_generation`, `style_analysis`, `recommendations`. Foreign key `user_id -> users.id`.
* `user_settings`: Global user model preferences single-row store (`post_generation_provider`, `post_generation_model`, `image_generation_provider`, `image_generation_model`). Foreign key `user_id -> users.id` (primary key).

#### 6. Learning & Analytics Tables
* `post_engagement_snapshots`: Periodically fetched engagement metrics for a published post at specific delays (`1hr`, `6hr`, `24hr`). Stores `likes_count`, `comments_count`, `shares_count`, `reach_count`, and calculated `engagement_score`. Foreign keys: `post_id -> post_logs.id`, `persona_id -> ai_personas.id`, `page_connection_id -> facebook_connections.id`.
* `learning_signals`: Performance observations used to train persona strategy models. Stores `signal_type` (`post_performance`), `signal_data` JSON, and `outcome_score`. Foreign keys: `user_id -> users.id`, `persona_id -> ai_personas.id`.
* `persona_learning_patterns`: Aggregated performance statistics grouped by feature buckets (`post length`, `ending type`, `format`, `time slot`). Stores `average_engagement_score` and `sample_size_count`. Foreign keys: `persona_id -> ai_personas.id`, `page_connection_id -> facebook_connections.id`.
* `learned_strategy`: Weekly synthesized strategy recommendations containing `strategy_data` JSON, `suggested_prompt`, `confidence_score`, and `applied_to_prompt` boolean. Foreign key `persona_id -> ai_personas.id`.
* `analytics_snapshots`: Aggregated daily/weekly page-level analytics metrics. Foreign keys: `user_id -> users.id`, `facebook_connection_id -> facebook_connections.id`.
* `ai_recommendations`: Actionable dashboard suggestions generated for a Facebook Page. Foreign key `page_connection_id -> facebook_connections.id`.
* `dashboard_suggestions`: User-facing prompt improvement recommendations. Foreign keys: `user_id -> users.id`, `persona_id -> ai_personas.id`.

#### 7. Brand Automation & Page Tracker Tables
* `brand_profiles`: Visual and voice brand identity configurations (`brand_name`, `logo_url`, `primary_color`, `secondary_color`, `accent_color`, `font_family`, `tone_voice`). Foreign key `user_id -> users.id`.
* `brand_dna`: Advanced extracted brand traits and design tokens. Foreign key `brand_profile_id -> brand_profiles.id`.
* `tracked_pages`: External/competitor Facebook pages being monitored for content analysis. Foreign key `user_id -> users.id`.
* `tracked_page_posts`: Scraped posts from monitored competitor pages (`content`, `likes_count`, `comments_count`, `shares_count`, `posted_at`). Foreign key `tracked_page_id -> tracked_pages.id`.
* `tracker_trends`: Aggregated topic and engagement trends derived from tracked pages. Foreign key `user_id -> users.id`.
* `style_analyses`: Extracted visual and copy style attributes from competitor posts. Foreign key `user_id -> users.id`.

---

### 3.2 Legacy, Superseded, and Orphaned Tables

> [!WARNING]
> The following 6 tables exist in `backend/app/models.py` from earlier migrations but are **superseded** by newer engines. Do not query or depend on these tables for new features:

1. `posts` — Superseded by `post_logs`. (`post_logs` contains full delivery status, Facebook post IDs, error messages, and persona relationships).
2. `scheduled_posts` — Superseded by `scheduled_slots`. (`scheduled_slots` links directly to `persona_schedules` and manages active slot lifecycles).
3. `schedules` — Superseded by `persona_schedules`. (Older legacy schedule definition table).
4. `persona_image_settings` — Superseded by `image_prompt_settings`. (Replaced by specialized prompt studio settings).
5. `background_assets` — Superseded by `template_background_assets`. (Replaced by template-specific asset registry with tsvector support).
6. `font_assets` — Superseded by `template_font_assets`. (Replaced by font asset manager supporting script detection and fontTools metadata).

*Note on `persona_schedules`*: `persona_schedules` is **NOT** orphaned. It is the active, live source of truth table mapped by the `PersonaSchedule` ORM model, storing active days, default times, day overrides, and timezone settings.

---

## 4. Auto-Posting & Scheduling System

### 4.1 APScheduler Engine Architecture & Ticks

Auto-posting is orchestrated by an in-process `apscheduler.schedulers.asyncio.AsyncIOScheduler` instance managed in `backend/app/scheduler.py`. On backend startup (`backend/app/main.py:_run_startup_initialization()`), `start_scheduler()` mounts four distinct background jobs:

```
                  +-------------------------------------------------------+
                  |               APScheduler Start Event                 |
                  |     (main.py -> scheduler.py:start_scheduler)         |
                  +-------------------------------------------------------+
                                              |
        +-------------------------+-----------+-----------+-------------------------+
        | (Every 24h at 00:00 UTC)| (Every 5 Minutes)     | (Every 1 Minute)        | (Every 10 Minutes)
        v                         v                       v                         v
+-----------------------+ +---------------------+ +---------------------+ +-----------------------+
| register_daily_slots  | |prepare_upcoming_    | | process_due_slots   | |    keep_db_alive    |
| (register_all_todays_ | |     slots           | | (process_due_       | | (SELECT 1 keepalive |
|        slots)         | |(prepare_upcoming_   | |   persona_slots)    | |        query)       |
|                       | |  persona_slots)     | |                     | |                     |
+-----------------------+ +---------------------+ +---------------------+ +-----------------------+
```

#### Step 1: Daily Slot Registration (CronTrigger: 00:00 UTC)
- Function called: `register_all_todays_slots()` in `backend/app/services/schedule_service.py`.
- Iterates all `PersonaSchedule` records where `is_active == True`.
- Calls `register_todays_slots(persona_id, db)`:
  1. Computes local time bounds for today in the persona's configured timezone (`get_today_bounds_utc`).
  2. Cleans up existing `pending` slots for today to avoid duplicates while preserving `published`, `generating`, `failed`, or `missed` slots.
  3. Evaluates `active_days`, `default_times`, and `day_overrides` via `get_todays_slots_for_persona()`.
  4. Inserts new `ScheduledSlot` DB records with `status = "pending"`.
  5. Schedules an exact in-memory `DateTrigger` job (`_schedule_exact_slot_job`) for each slot set to trigger `execute_slot_publish` at `ScheduledSlot.scheduled_at` with a 120-second misfire grace period.

#### Step 2: Slot Pre-Generation (IntervalTrigger: Every 5 Minutes)
- Function called: `prepare_upcoming_persona_slots()` in `backend/app/services/schedule_service.py`.
- Queries `ScheduledSlot` records where `status == "pending"` and `scheduled_at` is within the next 30 minutes (`scheduled_at <= now + 30m`).
- Calls `prepare_slot_publish(db, slot)` in `backend/app/services/slot_publish_service.py`:
  1. Validates persona exists and `facebook_connections.connection_status == "connected"`.
  2. Sets `slot.status = "generating"`.
  3. Executes `run_full_publish_flow(persona_id, db, is_test=True, slot=slot)`. This generates post text, extracts topic, and prepares the companion poster image without posting to Facebook.
  4. On success, sets `slot.status = "generated"` and links `slot.post_id`. On failure, sets `slot.status = "failed"` and records `slot.error_message`.

#### Step 3: Due Slot Execution (IntervalTrigger: Every 1 Minute)
- Function called: `process_due_persona_slots()` in `backend/app/services/schedule_service.py`.
- Queries `ScheduledSlot` records where `status.in_(["pending", "generated"])` and `scheduled_at <= now_utc`.
- Calls `execute_slot_publish(db, slot)` in `backend/app/services/slot_publish_service.py`:
  1. Sets `slot.status = "publishing"`.
  2. If the slot was pre-generated (`status == "generated"`), retrieves the existing `PostLog`. Otherwise, calls `run_full_publish_flow(...)` to generate content immediately.
  3. Calls `publish_post_to_facebook(db, post_log, connection)` in `backend/app/posts.py`.
  4. On Facebook API success, updates `post_log.status = "published"`, `post_log.delivery_status = "delivered"`, `slot.status = "published"`, increments `persona.total_posts_published`, updates `persona.last_auto_post_at = now`, and resets `persona.consecutive_failures = 0`.

---

### 4.2 External Webhooks vs. Process Restarts

- **Process Restart Persistence**: APScheduler stores job triggers **in-memory**. If the container/server restarts, in-memory `DateTrigger` jobs are cleared. However, on server startup (`main.py:_run_startup_initialization`), `register_all_todays_slots()` immediately executes, reads `persona_schedules` from PostgreSQL, recreates any missing `ScheduledSlot` rows, and re-registers in-memory jobs for all remaining today slots. Furthermore, the 1-minute `process_due_persona_slots` loop automatically catches up on any due slots that were missed during downtime.
- **External Cron Ping (cron-job.org / UptimeRobot)**:
  - Hits `/health` every 5 minutes to prevent host container sleep on platforms like Render.
  - Hits `POST /api/internal/run-scheduler` (authenticated via `X-Cron-Secret` header or `Bearer` token). This endpoint executes `run_scheduled_posts()` as an external backup trigger and updates `last_scheduler_run_at` for system health monitoring (`cron_health` response object).

---

### 4.3 Failure & Retry Logic

1. **Retries & Policy**:
   - Post text generation and Facebook Graph API HTTP calls do not execute infinite blind retries. If Facebook Graph API returns an HTTP error or token error, `publish_post_to_facebook` catches the exception, records `post_log.publish_error`, sets `post_log.status = "failed"` and `slot.status = "failed"`.
2. **Consecutive Failures & Auto-Deactivation**:
   - On publish failure, `persona.consecutive_failures` is incremented by `1`.
   - In `recalculate_persona_performance` (`backend/app/learning/service.py`), if `persona.learning_mode_enabled == True` and the weighted `persona.performance_score` drops below `0.25`, `persona.is_active` is automatically set to `False` to halt auto-posting for underperforming voices until reviewed.
3. **Recovery Mechanism**:
   - In `execute_slot_publish`, if an unhandled exception occurs after the Facebook API request was sent, the service re-queries `PostLog`. If Facebook succeeded (i.e. `facebook_post_id` was written), the slot recovers to `status = "published"` automatically rather than duplicating the post.

---

## 5. Poster / Image Generation Pipeline

The poster generation pipeline is the primary visual engine of AutoPoster. It renders high-resolution composite images locally using Pillow (PIL) without network overhead during canvas assembly.

### 5.1 Call Chain Overview

```
[Trigger: run_full_publish_flow / generatePoster]
                       |
                       v
    1. AI Art Director (art_director.py:run_art_director)
                       |
                       v
    2. Unified Resource Resolver (resource_resolver_unified.py:resolve_resource)
                       |  ├── Iconify Search API (resolve_icon)
                       |  ├── Gemoji Static Index (resolve_emoji)
                       |  ├── Cat API + Vision LLM + Ranking (cat_photo_resolver.py)
                       |  ├── Pexels Photo Query
                       |  └── PostgreSQL tsvector Caption Search (library_resolver.py)
                       v
    3. External Asset Cache (Supabase Storage: generated-images / image-templates)
                       |
                       v
    4. Composition Validator (composition_validator.py:validate_and_fix_composition)
                       |  ├── run_contrast_check (Overlay Opacity Auto-Fix)
                       |  ├── run_safe_zone_check (5% Margin Clamp Auto-Fix)
                       |  ├── run_text_fit_check (Font Size Shrink Auto-Fix)
                       |  └── run_overlap_check (Vertical Nudge Auto-Fix)
                       v
    5. Final Canvas Render (poster_renderer.py:render_poster_to_base64)
                       |  └── Pillow (PIL) Layer Compositing (Zero Network Calls)
                       v
    6. Vision Critic Pass (vision_critic.py:run_vision_critic)
                       |  └── Multi-modal Vision LLM Visual Hierarchy Inspection
                       v
[Base64 PNG Output & Supabase Public URL Storage]
```

---

### 5.2 Stage 1 — AI Art Director

- **Caller**: `backend/app/services/poster_orchestrator.py:generatePoster` (or `backend/app/routers/persona_image_templates.py`).
- **Function**: `run_art_director(topic, brand_palette_id, brand_font_pair_id, user_id, db)` in `backend/app/services/art_director.py`.
- **System Prompt & Constraints**: Loaded dynamically from design system JSON files (`templates.json`, `palettes.json`, `font-pairs.json`). Enforces design rules: headline/subheadline contrast, non-text visual elements, accent color usage, and mandatory `design_rationale` self-checklist.
- **Pydantic Schema Output (`ArtDirectorOutput`)**:
  ```python
  class BackgroundChoice(BaseModel):
      type: Literal["photo", "solid", "gradient"]
      pexels_query: Optional[str] = None
      fallback_type: Literal["solid", "gradient"] = "solid"

  class ElementItem(BaseModel):
      type: Literal["icon", "emoji", "cat_photo", "shape"]
      description: str  # e.g., "pizza slice", "smiling cat" (NO HARDCODED IDs)
      slot: str         # e.g., "accent_icon", "corner_badge"
      shape_id: Optional[str] = None

  class ArtDirectorOutput(BaseModel):
      design_rationale: Optional[str]
      headline: str
      subheadline: str
      mood: str
      template_id: str
      palette_id: str
      font_pair_id: str
      background_choice: BackgroundChoice
      use_contrast_overlay: bool
      elements: List[ElementItem]
      text_logo: Optional[TextLogo]
  ```

---

### 5.3 Stage 2 — Resource Resolution Strategies

The Art Director outputs plain-language descriptions (e.g. `"pizza slice"`). `backend/app/services/resource_resolver_unified.py:resolve_resource()` translates these into concrete asset URLs, codepoints, or SVG icons:

1. **Icons (`type == "icon"`)**:
   - **Module**: `backend/app/services/resource_resolver.py:resolve_icon(query)`.
   - **Strategy**: Calls Iconify HTTP Search API (`https://api.iconify.design/search?query={query}`). Returns top icon ID (e.g. `lucide:pizza`).
   - **Fallback**: If 0 results returned, calls `simplify_query()` (strips adjectives via `IGNORE_WORDS`, checks `SYNONYM_MAP`) and retries search. If still empty, falls back to `"lucide:sparkles"`.
2. **Emojis (`type == "emoji"`)**:
   - **Module**: `backend/app/services/resource_resolver.py:resolve_emoji(query)`.
   - **Strategy**: Searches local static JSON index (`emoji_index.json` compiled from GitHub Gemoji DB). Scores candidates: Exact alias match = 100, exact tag match = 80, description word match = 50, alias substring = 30.
   - **Fallback**: Returns best match if score >= 30; otherwise defaults to `"✨"`.
3. **Cat API Photos (`type == "cat_photo"`)**:
   - **Module**: `backend/app/services/cat_photo_resolver.py:resolve_cat_photo(theme_description)`.
   - **Strategy**:
     1. Maps theme against native Cat API categories (`sunglasses`, `hats`, `boxes`, `space`, `ties`, `clothes`, `sinks`).
     2. Fetches batch of 15 candidate photo URLs from Cat API.
     3. For uncached URLs, sends a single batched multi-modal vision LLM request (`_describe_images_batch`) to generate 1-sentence descriptions.
     4. Caches descriptions to disk in `cat_description_cache.json` keyed by URL.
     5. Asks LLM (`_rank_by_llm`) to rank cached descriptions against theme, returning score (0–1).
     6. If score < 0.40 (low confidence), fetches a 2nd batch of 15 photos, generates descriptions, and re-ranks across all 30 candidates, returning winner with `low_confidence = True`.
4. **Pexels Photos (`type == "photo"`)**:
   - **Strategy**: Uses `background_choice.pexels_query` string to fetch high-resolution background photos via Pexels Search API.
5. **Media Library / Background Assets (`type in ("library_image", "background_asset")`)**:
   - **Module**: `backend/app/services/library_resolver.py:resolve_from_library(description, scope, db, user_id)`.
   - **Strategy**: Full-text PostgreSQL search over vision-generated `caption` text. Executes strict AND `to_tsquery('english', ...)` against `caption_tsv` GIN index. If 0 rows match, falls back to `plainto_tsquery`. Results ordered by `ts_rank` DESC.

---

### 5.4 Stage 3 — External Asset Caching

- When an external image asset (Pexels, Cat API, AI image provider output) is selected for a post, `backend/app/routers/images.py:async_upload_to_supabase(filename, bytes)` mirrors the binary file to Supabase Storage (`generated-images` or `image-templates` buckets).
- The asset record is cached in `media_library` or `template_background_assets` storing `image_url` (public CDN URL), `storage_path`, `generation_prompt`, `provider`, `model_name`, and auto-generated `caption` string with `caption_tsv` tsvector index.

---

### 5.5 Stage 4 — Composition Validator

Executed by `validate_and_fix_composition()` in `backend/app/services/composition_validator.py`. Performs four deterministic layout checks and applies **in-place auto-fixes**:

1. **Contrast Check (`run_contrast_check`)**:
   - Calculates relative luminance: $L = 0.2126R + 0.7152G + 0.0722B$.
   - Computes WCAG contrast ratio: $(L_1 + 0.05) / (L_2 + 0.05)$.
   - Target threshold: `3.0` for headline text, `4.5` for subheadline text.
   - **Auto-Fix**: If ratio < threshold, iteratively increments dark `overlay_opacity` in steps of `+0.1` up to a maximum cap of `0.85`.
2. **Safe-Zone Check (`run_safe_zone_check`)**:
   - Defines mandatory 5% canvas margin (`margin_x = 0.05 * canvas_w`, `margin_y = 0.05 * canvas_h`).
   - **Auto-Fix**: Clamps element coordinates $(x, y, w, h)$ so no text or shape falls within the 5% border boundary.
3. **Text-Fit Check (`run_text_fit_check`)**:
   - Approximates character width as `0.6 * font_size` and line height as `1.2 * font_size`.
   - Calculates total wrapped text height vs slot bounding box height $h$.
   - **Auto-Fix**: If `total_height > h`, shrinks `font_size` by 10% per iteration until text fits inside the box or `font_size` reaches `12pt`.
4. **Overlap Check (`run_overlap_check`)**:
   - Sorts elements by priority (`text` = 2, `logo` = 1, `shape/icon` = 0).
   - Detects AABB rectangle overlaps (`_rect_overlap`).
   - **Auto-Fix**: Nudges lower-priority elements vertically downward by `overlap_height + 10px`, then re-runs safe-zone check.

---

### 5.6 Stage 5 — Vision Critic Pass

- **Function**: `run_vision_critic(image_bytes)` in `backend/app/services/vision_critic.py`.
- **Execution**: Converts rendered PNG bytes to Base64 data URI (`data:image/png;base64,...`). Sends image to vision LLM (`pixtral-12b-2409` or `gemini-2.0-flash`).
- **Inspection Criteria**: Evaluates visual hierarchy, spacing/breathing room, contrast, focal point clarity, and awkward cropping.
- **Output Schema (`VisionCriticResponse`)**:
  ```json
  {
    "status": "pass | needs_fix",
    "issue": "description of visual flaw",
    "target_slot": "headline | background | accent_icon",
    "suggested_change": "actionable patch instruction"
  }
  ```
- **Re-render Loop & Fail-Safe**: If critic returns `needs_fix`, suggestion is logged. If JSON parsing or vision LLM call fails, it fails open defaulting to `VisionCriticResponse(status="pass")`.

---

### 5.7 Stage 6 — Final Canvas Rendering Engine

- **Function**: `render_poster_to_base64(...)` in `backend/app/services/poster_renderer.py`.
- **Environment**: **Zero network calls during PIL canvas drawing.**
- **Rendering Steps**:
  1. Creates base RGBA canvas (`1080x1080`).
  2. Renders background: solid color or multi-color vertical linear gradient pixel buffer interpolation (`render_gradient_background`).
  3. Applies semi-transparent dark overlay (`Image.alpha_composite`) based on `overlay_opacity`.
  4. Rasterizes text layers using local TrueType fonts (`render_text` resolving font candidates from `backend/assets/fonts/` or system paths).
  5. Draws shape layers (`render_shape_layer` using PIL `ImageDraw.rounded_rectangle`, `ellipse`, or `rectangle`).
  6. Draws icon/emoji layers (`render_icon_or_emoji_layer`).
  7. Crops and pastes image layers (`render_image_layer` with LANCZOS resampling).
  8. Exports canvas to PNG bytes, saves local copy to `dry_run_output/`, and returns Base64 encoded string.

---

### 5.8 Summary of Failure & Fallback Behaviors

| Pipeline Stage | Potential Failure / Timeout | Deterministic Fallback Behavior |
|---|---|---|
| **Art Director** | LLM API timeout or invalid JSON output | Raises `ValueError`, caught by orchestrator; falls back to default template (`minimal_quote`) and solid background. |
| **Icon Resolver** | Iconify API 500 or 0 search results | Retries with simplified query (`simplify_query`); if still empty, defaults to `"lucide:sparkles"`. |
| **Emoji Resolver** | Unmatched description query | Returns best static Gemoji match if score >= 30; otherwise defaults to `"✨"`. |
| **Cat API Resolver** | Vision LLM failure or Cat API outage | Returns raw candidate photo without description; if score < 0.40, fetches 2nd batch; flags `low_confidence = True`. |
| **Library Resolver** | DB search returns 0 strict AND matches | Falls back from strict `to_tsquery` to loose `plainto_tsquery` (OR search across keywords). |
| **Image Generation Provider** | Provider timeout (e.g. Fal.ai / Stability timeout > 120s) | Respects persona `image_fallback_policy`: if `skip_post` -> aborts post; if `use_library` -> attaches oldest unused `media_library` image; if `text_only` -> publishes post text without image. |
| **Vision Critic** | Vision LLM API failure or invalid JSON | Fails open: returns `VisionCriticResponse(status="pass")` and permits post publish. |

---

## 6. Facebook Connection Lifecycle

Page connections are stored in `facebook_connections` and managed via `backend/app/facebook_oauth.py`.

```
                  +-----------------------------------+
                  |   GET /auth/facebook/login        |
                  | (_create_oauth_state -> state)    |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |  Facebook Dialog OAuth Redirect   |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |  GET /auth/facebook/callback      |
                  | (_exchange_code_for_token)        |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  | Save to pending_facebook_oauth    |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  | POST /auth/facebook/select-page   |
                  | (complete_page_selection)         |
                  +-----------------------------------+
                                    |
              +---------------------+---------------------+
              | (New Page)                                | (Existing Page)
              v                                           v
+-----------------------------+             +-----------------------------+
| Connection Status: CONNECTED|             | Connection Status: CONNECTED|
| encrypt_token(access_token) |             | encrypt_token(access_token) |
| reconnect_count = 0         |             | reconnect_count += 1        |
| connected_at = now          |             | disconnected_at = None      |
+-----------------------------+             | _resume_paused_posts()      |
                                            +-----------------------------+
                                                          ^
                                                          |
                                           (User Re-authenticates via OAuth)
                                                          |
                                            +-----------------------------+
                                            | Connection Status: DISCONNECTED
                                            | page_access_token = NULL    |
                                            | disconnected_at = now       |
                                            | Scheduled PostLogs -> PAUSED|
                                            +-----------------------------+
                                                          ^
                                                          |
                                          (POST /auth/facebook/disconnect)
```

### 6.1 State Transitions & Database Operations

1. **Connect Flow**:
   - `start_facebook_oauth`: Generates 16-byte hex state, stores in `oauth_states` (10-min expiry), redirects user to Facebook dialog.
   - `handle_facebook_callback`: Validates state against `oauth_states`. Exchanges short-lived code for long-lived user token (`_exchange_code_for_token`). Fetches managed pages (`_fetch_managed_pages`). Stores candidate pages in `pending_facebook_oauth` (15-min expiry).
   - `complete_page_selection`: Encrypts page access token using Fernet (`encrypt_token`). Saves new row in `facebook_connections` with `connection_status = "connected"`, `connected_at = now`, `reconnect_count = 0`.
2. **Disconnect Flow**:
   - `disconnect_page_connection(db, user_id, connection_id)`:
     - Sets `connection_status = "disconnected"`.
     - Sets `page_access_token = None` (clears token from DB).
     - Sets `disconnected_at = datetime.now(timezone.utc)`.
     - Queries `post_logs` for `facebook_connection_id == connection_id` and `status == "scheduled"`, updating status to `"paused"`.
3. **Reconnect Flow**:
   - When a user reconnects a previously disconnected page:
     - Updates `facebook_connections`: `connection_status = "connected"`, `page_access_token = encrypt_token(new_token)`, `disconnected_at = None`, `last_token_refresh = now`, increments `reconnect_count += 1`.
     - Executes `_resume_paused_posts(db, connection)`: Any `post_logs` in `"paused"` status scheduled for future dates (`scheduled_at > now`) are restored to `status = "scheduled"` and `delivery_status = "pending"`. Any paused posts whose scheduled time passed while disconnected (`scheduled_at <= now`) are updated to `status = "missed"`.
4. **Token Refresh Flow**:
   - `_exchange_code_for_token` automatically exchanges short-lived OAuth tokens (~2 hour expiry) for Facebook long-lived page access tokens (~60 day expiry). `token_expires_at` is tracked in `facebook_connections`.

---

## 7. AI Provider Configuration

Task-category routing is managed by `backend/app/providers/user_model_settings.py` and `backend/app/providers/llm_providers.py`.

### 7.1 Provider & Model Lookup Algorithm

When an application task requests text generation (e.g. `generate_text_for_user(user_id, task_category, ...)`):

```python
Task Category Requested (e.g., "post_generation", "image_prompt_generation")
                                  │
                                  ▼
      Does a `model_settings` row exist for (user_id, task_category)?
                                  │
                  ┌───────────────┴───────────────┐
             YES  │                               │  NO
                  ▼                               ▼
    Use provider/model from            Does a `user_settings` row exist
    `model_settings`. If user          for user_id?
    encrypted key present, decrypt.               │
                                         ┌────────┴────────┐
                                    YES  │                 │  NO
                                         ▼                 ▼
                           Use `post_generation_      Use system environment
                           provider` from             defaults (DEFAULT_LLM_PROVIDER
                           `user_settings`.           / DEFAULT_LLM_MODEL).
```

### 7.2 Strict Whitelist & Key Resolution

- **Allowed Models (`POST_ALLOWED`)**:
  - `openai`: `["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]`
  - `gemini`: `["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"]`
  - `anthropic`: `["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"]`
  - `mistral`: `["mistral-large-latest", "mistral-small-latest"]`
  - `openrouter`: `["openrouter/auto", "gpt-4-turbo", "claude-3.5-sonnet", "mistral-large"]`
- **Key Resolution Order**:
  1. `model_settings.api_key_encrypted` (Fernet decrypted).
  2. Platform environment variable (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`).
  3. If no key is configured, `_ensure_provider_key()` raises `MissingProviderKeyError(provider)`, returning a user-facing error directing the user to Settings.

---

## 8. Learning & Analytics Jobs

Managed in `backend/app/learning/service.py`.

### 8.1 Post Engagement Snapshot Job

- **Trigger**: Executed periodically via `run_engagement_snapshot_job()`.
- **Eligibility**: Queries published posts from the last 48 hours where `user.plan == "pro"`.
- **Snapshot Intervals (`SNAPSHOT_TYPES`)**: `1hr` (1 hour after post), `6hr` (6 hours after post), `24hr` (24 hours after post).
- **Graph API Metric Fetch**: `fetch_facebook_engagement()` queries Facebook Graph API for `likes.summary(true)`, `comments.summary(true)`, `shares`, and `insights.metric(post_impressions_unique)`.
- **Engagement Score Formula**:
  $$\text{engagement\_score} = (\text{likes} \times 1) + (\text{comments} \times 3) + (\text{shares} \times 5) + \left(\frac{\text{reach}}{100}\right)$$
- **Database Updates**:
  1. Saves record in `post_engagement_snapshots`.
  2. Creates observation in `learning_signals`.
  3. Updates `AIPersona` cumulative metrics (`total_likes_received`, `total_comments_received`, etc.).
  4. Calls `recalculate_persona_performance()`: Computes weighted average of the persona's last 20 24-hour snapshots. Normalizes against page average engagement to calculate `persona.performance_score` (clamped between `0.1` and `1.0`). If `learning_mode_enabled == True` and score < `0.25`, sets `persona.is_active = False`.

---

### 8.2 Weekly Strategy Learning Job

- **Trigger**: Executed weekly via `run_weekly_learning_job()`.
- **Eligibility**: Pro users with at least 2 active personas and 30+ total published posts.
- **Calculations & Outputs**:
  1. Iterates persona's recent 20 posts and evaluates performance across feature buckets: post length (`short`/`medium`/`long`), ending type (`question`/`statement`), hashtag usage (`with hashtags`/`without hashtags`), and time slot.
  2. Stores pattern metrics in `persona_learning_patterns` and updates `persona.learned_patterns_summary`.
  3. Calls `synthesize_weekly_strategy_for_persona()`: Aggregates last 30 days of `learning_signals` and sends to LLM (`synthesize_learned_strategy`).
  4. Creates/updates `learned_strategy` row storing `strategy_data` JSON (best post length, best posting hours, formats to increase/decrease), `confidence_score`, and LLM-generated `suggested_prompt`.
  5. Calls `regenerate_ai_recommendations()`: Generates up to 5 strategic advice items stored in `ai_recommendations`.
- **User Visibility**: Output is displayed in the Frontend Performance Insights dashboard (`get_performance_insights()`), showing persona score leaderboards, time-slot heatmaps, top performing post breakdowns, and actionable recommendations.

---

## 9. Known Gaps / TODOs

1. **Manual Prompt Application (`learned_strategy.suggested_prompt`)**:
   - *Status*: Implemented in backend (`synthesize_weekly_strategy_for_persona`), but `learned_strategy.applied_to_prompt` boolean flag is never automatically copied to `ai_personas.custom_prompt`. It requires explicit user confirmation in the UI to prevent overwriting user-configured persona prompts.
2. **Full-Text vs. Vector Search Upgrade (`library_resolver.py`)**:
   - *Status*: v1 PostgreSQL `caption_tsv` tsvector full-text search is active. `VECTOR(768)` embedding columns and pgvector similarity queries (`ORDER BY embedding <-> $vec`) are documented as a v2 upgrade path in module comments but not yet wired to an active embedding model.
3. **Multi-Iteration Vision Critic Re-Render Loop**:
   - *Status*: `run_vision_critic` successfully inspects rendered base64 PNGs and outputs JSON suggestions (`status`, `issue`, `target_slot`, `suggested_change`). However, automated multi-pass re-rendering based on critic feedback is operating in single-pass mode in `poster_orchestrator.py` (critique is logged but does not trigger an automated loop).
4. **Upstash QStash Webhook Triggers**:
   - *Status*: Upstash QStash HTTP trigger helpers are present in `schedule_service.py`, but the primary operational engine runs via APScheduler in-process tasks (`AsyncIOScheduler`) backed by `/api/internal/run-scheduler`.
5. **Legacy Table Schema Cleanups**:
   - *Status*: The 6 legacy tables (`posts`, `scheduled_posts`, `schedules`, `persona_image_settings`, `background_assets`, `font_assets`) remain in `backend/app/models.py` for migration backward-compatibility and must be pruned in a future database cleanup migration.

