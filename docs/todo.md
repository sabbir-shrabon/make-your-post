# AutoPoster Master Implementation Roadmap (from docs/audit.md)

## Phase 1: Unified Campaign & Post Generation Engine (Backend) ✅ [COMPLETED]
- [x] **Phase 1.1: Unified Campaign Service** (`backend/app/services/campaign_generator.py`)
  - [x] Single cognitive pass generating: Campaign Theme, Post Copy (Hook, Value Body, CTA), Hashtags, and Graphic Concept (Headline, Subheadline, Badge, Visual Query, Mood).
  - [x] Enhanced `art_director.py` and `poster_orchestrator.py` to accept semantic graphic concept hints (`headline_hint`, `subheadline_hint`, `badge_hint`, `visual_asset_query`, `mood_hint`).
  - [x] Generate visual design candidates with resolved assets and aesthetic scoring in the same unified pipeline.
- [x] **Phase 1.2: Unified Campaign Endpoint** (`backend/app/routers/campaign.py`)
  - [x] Expose `POST /api/campaign/generate-unified` with request/response schemas.
  - [x] Register `campaign.router` in `backend/app/main.py`.
- [x] **Phase 1.3: Bridge Background Scheduler** (`backend/app/services/publish_image_service.py`)
  - [x] Update `maybe_generate_image_for_post()` to utilize the Art Director / Poster pipeline for autonomous publishing.
  - [x] Verified end-to-end backend execution via test script.

---

## Phase 2: Consolidated Creator Studio UI (Frontend) ✅ [COMPLETED]
- [x] **Phase 2.1: Unified Creator Studio Component** (`frontend/src/components/dashboard/views/composer-view.tsx`)
  - [x] Agentic Campaign Autopilot prompt bar with 1-click "Generate Full Post & Poster".
  - [x] Full manual post copy editor with character limit indicator and secondary AI quick tools.
- [x] **Phase 2.2: Live Side-by-Side Facebook Feed Mockup**
  - [x] Left Panel: Full manual editor, interactive hashtag chips, media tabs, and scheduling.
  - [x] Right Panel: Interactive Facebook Post Mockup (avatar, page name, timestamp, post caption, rendered graphic poster).
  - [x] Direct Variant Switcher: Instant variant toggling (`★ Best`, `V2`, `V3`) directly inside the mockup.
- [x] **Phase 2.3: Seamless 1-Click Fine-Tuning & Scheduling**
  - [x] Embedded "Customize in Interactive Canvas" workbench modal for direct manipulation.
  - [x] Single-click "Publish Now", "Schedule Post", or "Save as Draft" flow.

---

## Phase 3: Brand Kit & Persona Simplification ✅ [COMPLETED]
- [x] **Phase 3.1: Simplified Brand Kit Profile** (`models.BrandProfile` / `brand_automation.py`)
  - [x] Store Page Logo URL, Primary Color, Secondary Color, Font Preference, Palette ID, and Niche Description.
  - [x] Auto-extract brand colors and logo with `POST /api/brand/auto-extract`.
- [x] **Phase 3.2: Persona Onboarding Wizard** (`frontend/src/components/dashboard/views/ai-settings-view.tsx`)
  - [x] Streamline persona setup to 3 core fields: Niche, Tone of Voice, Audience Goal.
  - [x] 1-Click Brand Kit card with auto-extraction from Facebook page.
  - [x] Relegate raw prompt templates, regex configs, and token settings to an Advanced Developer Drawer.

---

## Phase 4: Layout & Rendering Modernization ✅ [COMPLETED]
- [x] **Phase 4.1: Modern Design System Templates** (`templates.json` / `layouts.json`)
  - [x] Added contemporary editorial templates: `stat-metric-callout`, `editorial-quote-card`, and `minimal-takeaway-card`.
  - [x] Layout anchors and slot mapping registered in `layouts.json`.
- [x] **Phase 4.2: Modern Graphic Layer Engine** (`poster_renderer.py` / `composition_validator.py`)
  - [x] Intelligent multi-line text auto-wrapping with dynamic bounding-box scaling and subtle drop shadows.
  - [x] Soft directional gradient legibility overlays (`bottom_fade`, `top_fade`, `center_soft`) preserving stock photo vibrancy.
  - [x] Anti-aliased pill badges and resilient type normalization.

---

## Phase 5: Batch Content Campaign Planner (Niche-to-Calendar) ✅ [COMPLETED]
- [x] **Phase 5.1: Niche-Based Daily Theme Mapping** (`backend/app/services/campaign_generator.py`)
  - [x] Automated weekly schedule planner with recurring daily themes (`Case Study`, `How-To Tutorial`, `Contrarian Mindset`, `Mythbuster`, `Framework Checklist`, `Community Poll`, `Weekly Roadmap`).
- [x] **Phase 5.2: Multi-Day Campaign Generator & Scheduler** (`POST /api/campaign/generate-batch`, `POST /api/campaign/schedule-batch`)
  - [x] Generate 3-14 days of synchronized copy + matching branded posters in batch.
  - [x] Persist approved batch campaign posts into database scheduler.
- [x] **Phase 5.3: Visual Content Calendar & 1-Click Batch Approval UI** (`frontend/src/components/dashboard/views/scheduled-slots-view.tsx`)
  - [x] Dual-mode view: **Visual Calendar Grid** and **Structured List**.
  - [x] 1-Click **7-Day Batch Planner Modal** with duration selector, theme override, live generation, and instant batch approval.

---

## Phase 6: Custom Theme Engines & Meme Generators ✅ [COMPLETED]
- [x] **Phase 6.1: Custom Theme & Asset Library Manager** (`models.CustomTheme`, `models.ThemeAsset`, `routers/meme.py`)
  - [x] Built-in viral themes (*Cat & Pet Chaos*, *Tech & Dev Life*, *Startup & Founder Grind*, *Fitness & Gym Motivation*) and user-uploaded custom asset buckets.
- [x] **Phase 6.2: Daily Meme & Scenario Engine** (`services/meme_generator.py`, `services/meme_renderer.py`)
  - [x] Multi-format meme rendering: Classic Impact Meme and Modern Headline Card Meme.
  - [x] Cognitive humor generation with witty setup, punchline, Facebook caption, and hashtags.
- [x] **Phase 6.3: Viral Meme Studio UI** (`frontend/src/components/dashboard/views/meme-studio-view.tsx`, `dashboard/memes/page.tsx`)
  - [x] Theme picker, format switcher, 1-click AI meme generator, live preview tuning, and direct Facebook publishing/scheduling.

---

## Additional Capabilities: Custom Typography & Font Manager ✅ [COMPLETED]
- [x] **Dynamic Font Resolution Engine** (`backend/app/services/poster_renderer.py`, `backend/app/routers/fonts.py`)
  - [x] `POST /api/fonts/upload`: Support for user-uploaded `.ttf`, `.otf`, `.woff`, `.woff2` font files.
  - [x] `POST /api/fonts/download-google-font`: 1-Click download and installation of any Google Font directly into the system.
  - [x] Dynamic font resolution in PIL rendering pipeline supporting all installed custom fonts.
- [x] **Custom Font Manager UI** (`frontend/src/components/dashboard/views/ai-settings-view.tsx`)
  - [x] 1-Click Google Font Downloader with trending font pills.
  - [x] Drag-and-drop font file uploader.
  - [x] Installed Fonts Gallery with live preview and "Use in Brand Kit" assignment.

---

## Archived Completed Milestones
- [x] Master Database Migration & Schema Consolidation (`init.sql`)
- [x] Explicit Template Slot Discipline (`art_director.py`, `poster_orchestrator.py`)
- [x] Interactive Canvas Component with Konva (`InteractiveCanvas.tsx`)
- [x] Stateful Mutations & Layer Regeneration (`mutate-trace`, `regenerate-layer`)
- [x] Multi-Asset Candidate Discovery (Pexels & Iconify candidate arrays)
- [x] Facebook OAuth Polling Architecture (`/auth/facebook/status`)
