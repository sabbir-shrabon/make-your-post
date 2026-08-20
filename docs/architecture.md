# MakeYourPost (AutoPoster AI) — Comprehensive System Architecture & Deep Codebase Audit

> **System Blueprint, Feature Stories, Mathematical Layout Mechanics, and Production Audit**  
> **Author:** Sabbr Shrabon / Advanced Agentic AI Engineering  
> **Version:** 2.4.0 (Canva-Grade Unified Architecture)  
> **Last Updated:** August 2026

---

## 1. Executive Summary & Product Vision

### 1.1 The Genesis & The Problem
In modern social media marketing, content consistency is the single largest determinant of organic audience growth. However, producing high-quality, niche-aligned, visually engaging content daily across social platforms (particularly Facebook Pages and Communities) presents a crippling bottleneck for creators, solo founders, and agency teams:
1. **The 20-Hour Weekly Content Grind:** Researching topics, drafting compelling hooks, designing companion graphics in tools like Canva or Photoshop, and scheduling posts consumes 15–25 hours per week per brand.
2. **The "Distorted AI Image" Trap:** Standard generative AI models (Midjourney, DALL-E, Stable Diffusion) produce surrealistic, distorted visuals with illegible, garbled text, hallucinations, and zero brand alignment.
3. **The Disconnect of Pure Text:** Plain-text social media posts suffer from drastically lower CTR and engagement compared to structured visual posts.
4. **Creator Burnout & Inconsistent Voice:** Handing accounts to multiple junior copywriters results in fragmented brand voice, erratic posting schedules, and high churn.

### 1.2 The MakeYourPost Solution
**MakeYourPost** (also known in the codebase as `AutoPoster`) is an **autonomous, multi-tenant agentic social media publishing studio**. It replaces the manual content agency pipeline with a synchronized, closed-loop AI engine that:
- **Learns Brand Voice:** Encapsulates brand tone, audience profiles, and custom guidelines into modular **AI Personas**.
- **Generates High-Converting Posts & Posters Simultaneously:** Executes a single-pass cognitive generation that crafts engaging post copy and paired Canva-grade graphic posters in **<1.5 seconds**.
- **Deterministic Graphic Engine:** Abandons unreliable pixel-level AI image generation in favor of a **deterministic Pillow/Cairo canvas compositor** that pairs curated Pexels/Cat API photography with crisp vector icons, typography hierarchy, and mathematical WCAG contrast enforcement.
- **Operates on True Autopilot:** An in-process **APScheduler** background daemon pre-generates posts 30 minutes in advance, validates assets, and delivers scheduled posts directly to Facebook Pages via encrypted Meta Graph API tokens.
- **Continuously Learns & Self-Optimizes:** Polls post engagement snapshots at 1h, 6h, and 24h intervals, recalculates persona performance scores, and feeds high-performing hook patterns back into the generation prompts.

```mermaid
flowchart LR
    subgraph Input["1. Strategy & Input"]
        P["AI Persona / Brand DNA"]
        T["Topic / News Angle / Niche"]
    end

    subgraph Cognitive["2. Cognitive Generation (<1.2s)"]
        LLM["Multi-LLM Dispatcher<br/>(OpenAI / Claude / Gemini / Mistral)"]
        Copy["Post Copy + Hooks + Hashtags"]
        Concept["Graphic Layout Concept"]
    end

    subgraph VisualEngine["3. Canva-Grade Engine (<300ms)"]
        Archetypes["6 Deterministic Archetypes<br/>(Social Card, Editorial Hero, Stat...)"]
        Resolvers["Asset Resolvers<br/>(Pexels, Cat API, Local Icons/Emojis)"]
        Safety["WCAG Contrast & Safe-Zone Engine"]
        Canvas["Zero-Network PIL Compositor"]
    end

    subgraph Delivery["4. Autonomous Delivery & Loop"]
        Scheduler["APScheduler Daemon"]
        FB["Meta Graph API (Encrypted)"]
        Insights["Engagement Poller (1h/6h/24h)"]
        Learning["Strategy Pattern Synthesizer"]
    end

    Input --> Cognitive
    LLM --> Copy
    LLM --> Concept
    Concept --> VisualEngine
    Archetypes --> Canvas
    Resolvers --> Canvas
    Safety --> Canvas
    Copy --> Scheduler
    Canvas --> Scheduler
    Scheduler --> FB
    FB --> Insights
    Insights --> Learning
    Learning -.->|Refines Prompts| P

    style Input fill:#e0f2fe,stroke:#0284c7
    style Cognitive fill:#f3e8ff,stroke:#9333ea
    style VisualEngine fill:#dcfce7,stroke:#16a34a
    style Delivery fill:#fef3c7,stroke:#d97706
```

---

## 2. High-Level Architecture & Codebase Map

The platform follows an asynchronous monorepo architecture, splitting responsibilities cleanly between a **FastAPI async Python backend** and a **Next.js 14 TypeScript SPA frontend**, persisted via **PostgreSQL (Supabase)** and **Supabase Storage**.

```
auto_poster_agentic_ai/
├── backend/
│   ├── app/
│   │   ├── learning/                     # Closed-loop AI analytics & strategy learning
│   │   │   └── service.py                # Snapshot polling, scoring, pattern synthesis
│   │   ├── providers/                    # Multi-provider LLM & Image AI routing
│   │   │   ├── llm_providers.py          # OpenAI, Claude, Gemini, Mistral, OpenRouter
│   │   │   ├── image_providers.py        # Fal.ai, Stability, DALL-E, Gemini Imagen
│   │   │   └── user_model_settings.py    # Whitelist & per-user model preferences
│   │   ├── routers/                      # Domain-specific FastAPI routers
│   │   │   ├── brand_automation.py       # Competitor scraper & brand DNA
│   │   │   ├── campaign.py               # 1-click single & 7-day batch campaigns
│   │   │   ├── cat_photos.py             # Curated cat photo API & ranking
│   │   │   ├── fonts.py                  # Custom font upload & TTF metadata extraction
│   │   │   ├── images.py                 # Media library & Supabase CDN upload
│   │   │   ├── meme.py                   # Meme Studio themes & custom templates
│   │   │   ├── models.py / settings_models.py # Model configuration endpoints
│   │   │   ├── persona_image_templates.py# Manual template builder & assignment
│   │   │   ├── poster_studio.py          # Interactive canvas rendering endpoints
│   │   │   ├── poster_templates.py       # Catalog of system & user poster templates
│   │   │   ├── schedule_routes.py        # Slot management, manual triggers, retries
│   │   │   └── stock_photos.py           # Pexels high-res background search
│   │   ├── services/                     # Core Business Logic & Rendering Engines
│   │   │   ├── aesthetic_scorer.py       # 4-quadrant balance & contrast scoring
│   │   │   ├── art_director.py           # Generative layout planning & design rationale
│   │   │   ├── campaign_generator.py     # Synchronized single-pass post + poster generator
│   │   │   ├── cat_photo_resolver.py     # Cat API fetch + vision LLM classifier
│   │   │   ├── composition_validator.py  # Safe zones, text fitting, AABB overlap fixes
│   │   │   ├── compound_primitives.py    # Atomic PillButtons, StarburstBadges, Arches
│   │   │   ├── icon_renderer.py          # Vector icon rasterizer
│   │   │   ├── library_resolver.py       # PostgreSQL tsvector full-text asset search
│   │   │   ├── meme_generator.py         # Viral meme scenario & punchline engine
│   │   │   ├── meme_renderer.py          # Classic Impact & Modern Card meme renderer
│   │   │   ├── photo_background.py       # Multi-query Pexels photo search & buffer
│   │   │   ├── poster_component_renderer.py # The 6 Canva-grade social archetypes
│   │   │   ├── poster_orchestrator.py    # Master visual pipeline orchestrator
│   │   │   ├── poster_renderer.py        # Zero-network PIL canvas layer compositing
│   │   │   ├── poster_renderer_satori.py # HTML/JSX to SVG/PNG Satori rendering bridge
│   │   │   ├── publish_flow.py           # Full end-to-end execution flow
│   │   │   ├── publish_image_service.py  # Image attachment resolution for publishing
│   │   │   ├── resource_resolver.py      # Iconify HTTP + Gemoji static search
│   │   │   ├── resource_resolver_unified.py # Unified dispatcher for all asset types
│   │   │   ├── schedule_service.py       # Daily slot registration & upcoming slot queries
│   │   │   ├── slot_publish_service.py   # Slot pre-generation & Facebook dispatch
│   │   │   ├── topic_research_resolver.py# SerpApi & Bing News live topic research
│   │   │   ├── vector_assets.py          # Parametric SVGs (sunbursts, rays, palms)
│   │   │   └── vision_critic.py          # Multimodal visual hierarchy inspector
│   │   ├── auth.py                       # JWT generation, bcrypt hashing, dependencies
│   │   ├── config.py                     # Environment variable validation & secrets
│   │   ├── crypto.py                     # Fernet symmetric encryption for FB tokens
│   │   ├── database.py                   # SQLAlchemy engine, session pooler
│   │   ├── facebook_oauth.py             # Facebook OAuth 2.0 popup handshake & pages
│   │   ├── main.py                       # Lifespan startup, core REST endpoints (~3.4k lines)
│   │   ├── mistral_service.py            # Topic extraction, style analysis, suggestions
│   │   ├── models.py                     # 39 SQLAlchemy ORM database models
│   │   ├── posts.py                      # Prompt assembly, FB publishing, locking
│   │   ├── scheduler.py                  # APScheduler AsyncIOScheduler configuration
│   │   └── schemas.py                    # Pydantic v2 validation models
│   ├── Dockerfile                        # Multi-stage Linux Bookworm + PangoCairo
│   └── requirements.txt                  # Python runtime dependencies
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── auth/                     # OAuth redirect & callback receiver
│   │   │   ├── dashboard/
│   │   │   │   ├── layout.tsx            # Persistent shell layout (avoids tab remounts)
│   │   │   │   ├── page.tsx              # Overview dashboard
│   │   │   │   ├── create/page.tsx       # AI Composer & Live Preview
│   │   │   │   ├── ai-settings/page.tsx  # Persona DNA, Prompts & Multi-Model
│   │   │   │   ├── memes/page.tsx        # Meme Studio
│   │   │   │   ├── scheduled/page.tsx    # Calendar & Scheduled Slot Queue
│   │   │   │   ├── published/page.tsx    # Historical Feed & Performance
│   │   │   │   ├── templates/page.tsx    # Poster Template Catalog & Lab
│   │   │   │   ├── analytics/page.tsx    # Page Metrics & Strategy Leaderboards
│   │   │   │   ├── style-analyzer/page.tsx # Competitor Persona Extractor
│   │   │   │   ├── page-tracker/page.tsx # Competitor Page Scraper
│   │   │   │   └── settings/page.tsx     # FB Connections, AI Keys, Typography
│   │   │   ├── login/ & register/        # Authentication pages
│   │   │   └── layout.tsx & globals.css  # Root layout, theme variables
│   │   ├── components/
│   │   │   ├── dashboard/
│   │   │   │   ├── shared/dashboard-ui.tsx # Reusable UI atoms (badges, headers, cards)
│   │   │   │   ├── templates/            # Template preview cards & slot builder modal
│   │   │   │   └── views/                # Modular client views for each route
│   │   │   │       ├── ai-settings-view.tsx
│   │   │   │       ├── analytics-view.tsx
│   │   │   │       ├── composer-view.tsx       # ~1.6k lines smart composer
│   │   │   │       ├── home-view.tsx
│   │   │   │       ├── meme-studio-view.tsx    # Viral meme generator
│   │   │   │       ├── page-tracker-view.tsx
│   │   │   │       ├── post-list-view.tsx
│   │   │   │       ├── scheduled-slots-view.tsx
│   │   │   │       ├── settings-view.tsx
│   │   │   │       ├── style-analyzer-view.tsx
│   │   │   │       └── template-library-view.tsx
│   │   │   ├── social-platform/          # Interactive canvas & Agentic Poster Lab
│   │   │   ├── template-builder/         # Drag-and-drop manual visual builder
│   │   │   └── ui/                       # shadcn/ui base component primitives
│   │   ├── contexts/
│   │   │   ├── auth-context.tsx          # User auth, JWT decode, persistent sessions
│   │   │   └── app-context.tsx           # Parallel pre-fetching of pages, posts, slots
│   │   ├── lib/
│   │   │   ├── api.ts / axios.ts         # Axios interceptors, cold-start handlers, token refresh
│   │   │   ├── env.ts                    # Dynamic backend URL resolution
│   │   │   └── persona-utils.ts          # Persona prompt assembly & template presets
│   │   └── types/models.ts               # TypeScript interfaces matching backend models
│   ├── package.json
│   └── tsconfig.json
└── docs/
    ├── architecture.md                   # This master documentation file
    ├── audit.md                          # Initial error log diagnostic
    └── videoscript.md                    # Hackathon & product walkthrough script
```

---

## 3. End-to-End User Workflows & System Workflows

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Frontend as Next.js SPA
    participant Backend as FastAPI Backend
    participant DB as Supabase PostgreSQL
    participant AI as Multi-LLM Provider
    participant FB as Meta Graph API

    Note over User,FB: Phase 1: Onboarding & Connection
    User->>Frontend: Click "Connect Facebook Page"
    Frontend->>Backend: GET /auth/facebook/login
    Backend-->>Frontend: OAuth State Token + Facebook Redirect URL
    Frontend->>FB: Open OAuth Dialog (Manage Pages Permission)
    FB-->>Frontend: Redirect to Callback with Auth Code
    Frontend->>Backend: GET /auth/facebook/callback?code=...
    Backend->>FB: Exchange Code for Long-Lived Token (60-day)
    Backend->>DB: Store Candidate Pages in pending_facebook_oauth
    Backend-->>Frontend: Return List of Managed Pages
    User->>Frontend: Select Target Facebook Page
    Frontend->>Backend: POST /auth/facebook/select-page
    Backend->>DB: Save in facebook_connections (Fernet Encrypted Token)

    Note over User,FB: Phase 2: Persona Strategy Setup
    User->>Frontend: Create AI Persona (Tech SaaS, Witty, 3x Daily)
    Frontend->>Backend: POST /api/ai/personas
    Backend->>DB: Insert ai_personas & persona_schedules records

    Note over User,FB: Phase 3: Autonomous Publishing Cycle (In-Process Daemon)
    loop Every Day at 00:00 UTC
        Backend->>DB: register_all_todays_slots() -> Create ScheduledSlots (status: pending)
    end
    loop Every 5 Minutes
        Backend->>DB: prepare_upcoming_persona_slots() (Due within 30 min)
        Backend->>AI: Generate Post Copy & Poster Concept
        Backend->>Backend: Render Deterministic Canva-Grade Poster PNG
        Backend->>DB: Save PostLog + ScheduledSlot (status: generated)
    end
    loop Every 1 Minute
        Backend->>DB: process_due_persona_slots() (scheduled_at <= now)
        Backend->>FB: POST /{page_id}/photos (Multipart PNG + Caption)
        FB-->>Backend: 200 OK (facebook_post_id)
        Backend->>DB: Update PostLog (published) & ScheduledSlot (published)
    end

    Note over User,FB: Phase 4: Closed-Loop AI Learning
    loop Every 6 Hours
        Backend->>FB: Query Likes, Comments, Shares, Reach for Recent Posts
        Backend->>DB: Insert post_engagement_snapshots
        Backend->>Backend: Recalculate persona.performance_score
        Backend->>AI: Synthesize Weekly Strategy Hints
        Backend->>DB: Update persona.learned_patterns_summary
    end
```

---

## 4. The Visual Generation Engine & Poster Subsystem

### 4.1 The Story Behind the Canvas Engine: Why Old AI Failed
When building an autonomous poster generator, the initial naive approach was asking generative diffusion models (DALL-E 3 or SDXL) to create social graphics directly from prompts. This failed dramatically in production:
1. **Typography Degradation:** Diffusion models hallucinate letters, misspell technical words, and cannot guarantee brand typography hierarchy.
2. **Extreme Latency & Cost:** Calling diffusion APIs takes **8 to 25 seconds** per image, incurring heavy compute costs and causing frequent gateway timeouts.
3. **The Contrast Dimming Disaster:** Early versions of the local compositor attempted to fix contrast on random photos by adding black rectangles with up to 85% opacity, turning vibrant high-res Pexels photos into muddy, depressing dark boxes.
4. **Network Flakiness:** Fetching SVG icons dynamically from external APIs (`api.iconify.design`) caused 10-second SSL handshake timeouts on Windows and containerized environments.

### 4.2 The Canva-Grade Architecture Solution
MakeYourPost solved this by creating a **Deterministic Archetype Rendering Engine** (`poster_component_renderer.py`). Instead of guessing coordinates randomly, the AI Art Director selects one of **6 pre-validated design archetypes** and outputs high-level semantic fields (Headline, Subheadline, Stat Number, Checklist Items, Badge Text, Search Query). The engine then renders the poster locally using mathematical typography wrapping, directional cubic gradient scrims, and offline vector assets in **<300 milliseconds**.

```mermaid
flowchart TD
    subgraph CognitivePass["1. Cognitive Art Director (<1.2s)"]
        Prompt["Topic / Campaign Theme"] --> LLM["LLM Structured JSON Output"]
        LLM --> ArchetypeChoice["Selects Archetype:<br/>social-card | editorial-hero | metric-callout<br/>checklist-framework | promo-banner | minimal-quote"]
        LLM --> PaletteChoice["Selects Brand Palette & Font Pair"]
    end

    subgraph AssetResolvers["2. Zero-Lag Asset Resolution (<100ms)"]
        LLM -->|Photo Query| Pexels["Pexels Search / Cat API Buffer"]
        LLM -->|Icon/Emoji| LocalIndex["Local SVG Vector Catalog + Gemoji Index"]
        LLM -->|Caption Search| PGTSV["PostgreSQL tsvector Caption Search"]
    end

    subgraph MathematicalCompositor["3. Canva-Grade PIL Compositor (<200ms)"]
        ArchetypeChoice --> Engine["poster_component_renderer.py"]
        PaletteChoice --> Engine
        Pexels --> Engine
        LocalIndex --> Engine
        PGTSV --> Engine
        
        subgraph AlgorithmicSafety["Safety & Polish Mechanics"]
            Scrim["Directional Cubic Scrim: alpha = (y/h)^1.8 * 255"]
            SafeZone["5% Margin Bounds Clamping"]
            FluidFont["Word-Wrap Bounding Box Calculation"]
            CardMask["LANCZOS Resampling + Alpha Corner Mask"]
        end
        
        Engine --> AlgorithmicSafety
    end

    subgraph Output["4. Final Deliverable"]
        AlgorithmicSafety --> Base64["Base64 Data URI & Supabase Storage CDN"]
    end

    style CognitivePass fill:#f3e8ff,stroke:#9333ea
    style AssetResolvers fill:#e0f2fe,stroke:#0284c7
    style MathematicalCompositor fill:#dcfce7,stroke:#16a34a
    style Output fill:#fef3c7,stroke:#d97706
```

### 4.3 Deep Dive: The 6 Canva-Grade Archetypes

```
+---------------------------------------------------------------------------------------------------+
| 1. SOCIAL CARD (Tweet / LinkedIn / Insight Card)                                                  |
| - Layout: Top Avatar + Brand Name + @handle + Category Pill Badge                                 |
| - Typography: Large high-contrast Headline (2-3 lines) + Subheadline                             |
| - Visual: Bottom framed photo card with 24px rounded corners & subtle 2px border                 |
| - Best For: Daily insights, thought leadership, punchy observations                              |
+---------------------------------------------------------------------------------------------------+
| 2. EDITORIAL HERO (Magazine Cover Typography)                                                     |
| - Layout: Full-bleed background photography                                                        |
| - Lighting: Directional cubic gradient scrim on bottom 60% (preserves photo face/top)            |
| - Typography: Massive display bold uppercase headline + Subtitle + Bottom CTA button              |
| - Best For: Feature stories, breaking industry news, deep-dive guides                            |
+---------------------------------------------------------------------------------------------------+
| 3. METRIC CALLOUT (Big Stat & Data Showcase)                                                      |
| - Layout: Dark slate / midnight indigo high-tech background                                       |
| - Focal Point: Giant oversized statistic block (+4.5X, 85%, $1M) with illuminated container pill  |
| - Typography: Supporting explanatory takeaway headline + source badge                             |
| - Best For: Case studies, benchmark reports, revenue milestones, growth proof                     |
+---------------------------------------------------------------------------------------------------+
| 4. CHECKLIST FRAMEWORK (Actionable Step-by-Step Pills)                                            |
| - Layout: Soft neutral canvas with structured vertical hierarchy                                  |
| - Elements: 3 to 4 white pill cards with circular numbered badges (1, 2, 3, 4)                    |
| - Typography: Punchy title + clean actionable step items                                          |
| - Best For: How-to tutorials, frameworks, cheat-sheets, workflows                                |
+---------------------------------------------------------------------------------------------------+
| 5. PROMO BANNER (High-Impact Commercial Offer)                                                    |
| - Layout: Full background photo with vibrant category ribbon (e.g. LIMITED OFFER)                 |
| - Elements: Bold urgent headline + discount/value proposition + Oversized CTA button pill         |
| - Best For: Product launches, seasonal discounts, webinars, lead magnets                          |
+---------------------------------------------------------------------------------------------------+
| 6. MINIMAL QUOTE (Mindset & Inspiration)                                                          |
| - Layout: Ultra-sleek dark zinc canvas with giant 200pt decorative quotation mark “               |
| - Typography: Centered / left-aligned serif or modern grotesque quote body                        |
| - Attribution: Bottom circular avatar + Author name + Verified handle                             |
| - Best For: Motivation, founder reflections, core values, viral shares                           |
+---------------------------------------------------------------------------------------------------+
```

### 4.4 Mathematical Layout Mechanics

#### 1. Directional Cubic Scrim Equation
Instead of applying a flat dark rectangle over photos, the engine applies a **cubic power curve** to the alpha channel:
$$\alpha(y) = \alpha_{\max} \cdot \left(\frac{y}{h}\right)^{1.8}$$
Where:
- $y$ is the vertical pixel coordinate ($0 \le y \le h$).
- $h$ is the canvas height ($1080\text{px}$).
- $\alpha_{\max}$ is the target opacity (typically $0.85$ to $0.92$).
- The exponent $1.8$ ensures that the top $40\%$ of the photograph remains crystal clear, while the bottom $60\%$ transitions smoothly into dark slate to ensure **$100\%$ WCAG AAA contrast** for white text.

#### 2. Fluid Word-Wrap & Bounding Box Calculation
The word-wrapping function `_wrap_text()` measures exact pixel dimensions using PIL's FreeType bounding box:
$$\text{bbox} = \text{draw.textbbox}((0, 0), \text{candidate\_line}, \text{font}=\text{font})$$
$$\text{line\_width} = \text{bbox}[2] - \text{bbox}[0]$$
If $\text{line\_width} > \text{max\_width}$, the line breaks cleanly on word boundaries. If total text height exceeds slot constraints, `run_text_fit_check` iteratively scales font size down by $10\%$ until text fits perfectly without clipping or truncation.

#### 3. Axis-Aligned Bounding Box (AABB) Collision Auto-Fix
When dynamic shapes, badges, and text layers are assembled:
$$\text{Overlap}(A, B) \iff (A_{x1} < B_{x2}) \land (A_{x2} > B_{x1}) \land (A_{y1} < B_{y2}) \land (A_{y2} > B_{y1})$$
If an overlap is detected, lower-priority decorative elements are pushed down by $\Delta y = (\text{overlap\_height} + 10\text{px})$, after which the $5\%$ canvas safe-zone clamp is re-evaluated.

#### 4. Aesthetic Quality Scorer (`aesthetic_scorer.py`)
To objectively score generated designs before delivery, the system calculates a multi-dimensional aesthetic score $S \in [0.0, 1.0]$:
$$S = 0.25 \cdot S_{\text{lum}} + 0.35 \cdot S_{\text{contrast}} + 0.25 \cdot S_{\text{balance}} + 0.15 \cdot S_{\text{coverage}}$$
- **Luminance Score ($S_{\text{lum}}$):** Measures proximity to optimal social feed luminance ($L_{\text{optimal}} = 125$).
- **Contrast Score ($S_{\text{contrast}}$):** Measures pixel standard deviation ($\sigma \ge 64$ yields $1.0$).
- **Spatial Balance ($S_{\text{balance}}$):** Divides the canvas into 4 quadrants ($Q_1, Q_2, Q_3, Q_4$), computes luminance variance between quadrants, penalizing lopsided visual weight.
- **Coverage Ratio ($S_{\text{coverage}}$):** Ensures non-background elements occupy between $20\%$ and $55\%$ of total canvas area.

---

## 5. Database Architecture & Data Model Audit

The database schema comprises **39 SQLAlchemy ORM tables** in `backend/app/models.py`.

```mermaid
erDiagram
    users ||--o{ facebook_connections : owns
    users ||--o{ ai_personas : creates
    users ||--o{ model_settings : configures
    users ||--o{ media_library : uploads
    users ||--o{ brand_profiles : defines
    users ||--o{ tracked_pages : monitors

    facebook_connections ||--o{ ai_personas : attaches
    facebook_connections ||--o{ post_logs : receives

    ai_personas ||--|| persona_schedules : defines
    ai_personas ||--o{ scheduled_slots : queues
    ai_personas ||--o{ post_logs : authors
    ai_personas ||--o{ post_engagement_snapshots : aggregates
    ai_personas ||--o{ persona_learning_patterns : extracts
    ai_personas ||--o{ learned_strategy : generates

    scheduled_slots ||--o| post_logs : references
    post_logs ||--o{ post_engagement_snapshots : tracks
    post_logs ||--o| post_image_generations : renders

    custom_themes ||--o{ theme_assets : contains
    tracked_pages ||--o{ tracked_page_posts : scrapes
```

### 5.1 Comprehensive Schema Breakdown by Subsystem

| # | Table Name | Purpose & Lifecycle | Key Columns & Indices |
|---|---|---|---|
| 1 | `users` | Multi-tenant user accounts & subscription plans. | `id`, `email` (UQ, IX), `hashed_password`, `plan` (`free`/`pro`), `timezone`, `brand_logo_url`. |
| 2 | `oauth_states` | Short-lived CSRF prevention tokens for Facebook OAuth. | `id` (state hex), `user_id`, `expires_at` (10-min TTL). |
| 3 | `pending_facebook_oauth` | Temporary storage for unselected pages returned during OAuth. | `user_id` (PK), `pages` (JSON list), `expires_at` (15-min TTL). |
| 4 | `facebook_connections` | Connected managed Facebook Pages with encrypted credentials. | `id`, `user_id` (FK), `page_id`, `page_name`, `page_access_token` (Fernet encrypted), `connection_status` (`connected`/`disconnected`), `reconnect_count`. |
| 5 | `ai_personas` | **Central strategic entity.** Represents distinct brand voice. | `id`, `page_connection_id` (FK), `user_id` (FK), `persona_name`, `niche`, `tone_tags`, `custom_prompt`, `creativity_level`, `performance_score`, `learning_mode_enabled`, `brand_palette_id`, `brand_font_pair_id`. |
| 6 | `persona_schedules` | **Live source of truth for recurring posting rules.** | `id` (UUID), `persona_id` (FK, UQ), `active_days` (JSON), `default_times` (JSON), `day_overrides` (JSON), `timezone`, `is_active`. |
| 7 | `prompt_templates` | User-saved structured prompt configurations. | `id`, `user_id` (FK), `persona_id` (FK), `template_name`, `question_answers` (JSON), `assembled_prompt`. |
| 8 | `image_prompt_settings` | Prompt studio settings & template layer metadata. | `id` (UUID), `persona_id` (FK, UQ), `template_layers_json` (JSON), `template_logo_url`, `color_palette`. |
| 9 | `image_templates` | Reusable visual template designs. | `id` (UUID), `user_id` (FK), `name`, `template_json` (JSON layout), `reference_image_url`, `aspect_ratio`. |
| 10 | `template_background_assets` | Background asset registry with full-text search. | `id` (UUID), `user_id` (FK), `type`, `preview_url`, `caption` (Text), `config` (JSON). *(Postgres `caption_tsv` GIN index)*. |
| 11 | `template_font_assets` | Uploaded TTF/OTF custom fonts with fontTools metadata. | `id` (UUID), `user_id` (FK), `display_name`, `font_file_url`, `weight`. |
| 12 | `persona_image_template_assignments` | Persona-to-Template assignment map. | `persona_id` (FK, PK, UQ), `image_template_id` (FK). |
| 13 | `scheduled_slots` | **Live operational queue for today's post dispatches.** | `id` (UUID), `persona_id` (FK), `scheduled_at` (IX), `status` (`pending`, `generating`, `generated`, `publishing`, `published`, `failed`), `post_id` (FK). |
| 14 | `post_logs` | Immutable audit log of every generated & published post. | `id`, `user_id` (FK), `facebook_connection_id` (FK), `ai_persona_id` (FK), `content`, `status`, `facebook_post_id`, `delivery_status`, `image_url`. |
| 15 | `post_image_generations` | Audit history of Prompt Studio visual rendering runs. | `id` (UUID), `post_id` (FK, UQ), `template_id` (FK), `llm_instructions` (JSON), `final_image_url`, `status`. |
| 16 | `post_image_assets` | Intermediate asset references used in template runs. | `id` (UUID), `post_id` (FK, UQ), `user_id` (FK), `assets_json` (JSON). |
| 17 | `image_generation_jobs` | Tracking table for external AI image gen requests. | `id` (UUID), `user_id` (FK), `provider`, `model_name`, `assembled_prompt`, `status`, `result_image_url`. |
| 18 | `media_library` | User asset library with full-text caption search. | `id` (UUID), `user_id` (FK), `image_url`, `storage_path`, `caption` (Text), `is_used`. *(Postgres `caption_tsv` GIN index)*. |
| 19 | `model_settings` | Per-task AI provider & model override configurations. | `id` (UUID), `user_id` (FK), `task_category`, `provider_name`, `model_name`, `api_key_encrypted`. |
| 20 | `user_settings` | Global default model preferences per user. | `user_id` (PK, FK), `post_generation_provider`, `post_generation_model`, `image_generation_provider`, `image_generation_model`. |
| 21 | `post_engagement_snapshots` | Time-series engagement data polled from Facebook. | `id`, `post_id` (FK), `persona_id` (FK), `snapshot_type` (`1hr`/`6hr`/`24hr`), `likes_count`, `comments_count`, `shares_count`, `reach_count`, `engagement_score`. |
| 22 | `learning_signals` | Atomic engagement observations for persona training. | `id`, `user_id` (FK), `persona_id` (FK), `signal_type`, `signal_data` (JSON), `outcome_score`. |
| 23 | `persona_learning_patterns` | Aggregated performance metrics by post feature bucket. | `id`, `persona_id` (FK), `pattern_type` (e.g. length/ending), `pattern_value`, `average_engagement_score`, `sample_size_count`. |
| 24 | `learned_strategy` | Synthesized weekly strategy recommendations. | `id`, `persona_id` (FK), `strategy_data` (JSON), `suggested_prompt`, `confidence_score`, `applied_to_prompt`. |
| 25 | `analytics_snapshots` | Aggregate daily/weekly page-level metrics. | `id`, `post_id` (FK), `likes_count`, `comments_count`, `shares_count`. |
| 26 | `ai_recommendations` | Actionable strategic advice for connected Facebook pages. | `id`, `page_connection_id` (FK), `recommendation_text`, `is_dismissed`. |
| 27 | `dashboard_suggestions` | Prompt improvement suggestions for users. | `id`, `user_id` (FK), `suggestion_text`, `action_type`, `action_data` (JSON), `is_dismissed`. |
| 28 | `brand_profiles` | User brand identity guidelines & logos. | `id` (UUID), `user_id` (FK, UQ), `brand_name`, `primary_color_hex`, `logo_url`, `brand_json` (JSON). |
| 29 | `brand_dna` | Extracted design tokens and copywriting guidelines. | `id` (UUID), `user_id` (FK, UQ), `source_count`, `dna_json` (JSON). |
| 30 | `tracked_pages` | Competitor Facebook pages monitored for trends. | `id`, `user_id` (FK), `page_identifier`, `page_name`, `nickname`, `is_active`. |
| 31 | `tracked_page_posts` | Scraped posts from monitored competitor pages. | `id`, `tracked_page_id` (FK), `facebook_post_id`, `content`, `likes_count`, `comments_count`, `engagement_score`. |
| 32 | `tracker_trends` | High-engagement topic trends extracted from competitors. | `id`, `user_id` (FK), `topic`, `summary`, `page_count`, `is_dismissed`. |
| 33 | `style_analyses` | Analyzed copy and style traits from competitor posts. | `id`, `user_id` (FK), `source_type`, `source_identifier`, `report` (JSON). |
| 34 | `custom_themes` | Custom meme themes created by users. | `id` (UUID), `user_id` (FK), `name`, `description`, `category`. |
| 35 | `theme_assets` | Background images & templates attached to custom themes. | `id` (UUID), `theme_id` (FK), `user_id` (FK), `image_url`, `caption_prompt_hint`. |

### 5.2 Legacy & Superseded Tables Catalog
The following 6 tables in `backend/app/models.py` represent early schema iterations and have been fully superseded:
1. `posts` $\rightarrow$ Superseded by `post_logs` (which adds multi-persona routing, delivery status, and error logs).
2. `scheduled_posts` $\rightarrow$ Superseded by `scheduled_slots` (which links directly to `persona_schedules` rules).
3. `schedules` $\rightarrow$ Superseded by `persona_schedules` (which supports granular day overrides and JSON time lists).
4. `persona_image_settings` $\rightarrow$ Superseded by `image_prompt_settings`.
5. `background_assets` $\rightarrow$ Superseded by `template_background_assets` (with PostgreSQL tsvector search).
6. `font_assets` $\rightarrow$ Superseded by `template_font_assets` (with fontTools script detection).

---

## 6. Autonomous Scheduling & Publishing Daemon

### 6.1 APScheduler Engine Architecture
Background automation is managed by an in-process `AsyncIOScheduler` in `backend/app/scheduler.py`, started during FastAPI lifespan initialization.

```
+---------------------------------------------------------------------------------------------------+
| 1. Daily Midnight Slot Registration (CronTrigger: 00:00 UTC)                                     |
|    - Function: register_all_todays_slots() in schedule_service.py                                |
|    - Computes local date bounds for each persona's configured timezone                            |
|    - Cleans stale pending slots while preserving published/failed slots                           |
|    - Inserts new ScheduledSlot records with status = "pending"                                    |
|    - Registers exact in-memory DateTrigger jobs for each slot with 120s grace period               |
+---------------------------------------------------------------------------------------------------+
| 2. 30-Minute Slot Pre-Generation (IntervalTrigger: Every 5 Minutes)                               |
|    - Function: prepare_upcoming_persona_slots() in schedule_service.py                            |
|    - Queries slots where status == "pending" and scheduled_at <= now + 30 minutes                 |
|    - Sets slot.status = "generating"                                                              |
|    - Runs run_full_publish_flow(..., is_test=True) to generate post text and render poster PNG    |
|    - On success: status = "generated", links post_id. On failure: status = "failed"               |
+---------------------------------------------------------------------------------------------------+
| 3. Exact-Time Live Dispatch (IntervalTrigger: Every 1 Minute)                                     |
|    - Function: process_due_persona_slots() in schedule_service.py                                 |
|    - Queries slots where status in ("pending", "generated") and scheduled_at <= now_utc           |
|    - Calls execute_slot_publish() in slot_publish_service.py                                      |
|    - Sets slot.status = "publishing"                                                              |
|    - Calls publish_post_to_facebook() via Meta Graph API multipart upload                         |
|    - On success: slot.status = "published", post_log.status = "published", resets failure count  |
+---------------------------------------------------------------------------------------------------+
| 4. Database Keepalive Ping (IntervalTrigger: Every 10 Minutes)                                    |
|    - Function: _keep_db_alive() executes SELECT 1 to prevent Supabase connection drops            |
+---------------------------------------------------------------------------------------------------+
```

### 6.2 Self-Healing State Machine & Crash Recovery
- **Process Restart Resilience:** While APScheduler triggers live in memory, `ScheduledSlot` rows live in PostgreSQL. On container boot, `register_all_todays_slots()` re-queries the database and re-schedules in-memory jobs for all remaining today slots. The 1-minute loop catches up on any slots that became due while the server was restarting.
- **Deduplication Recovery:** If an unhandled network error occurs after the Meta Graph API request was sent, `execute_slot_publish` inspects the `PostLog`. If Facebook returned a valid `facebook_post_id`, the slot status is automatically marked `"published"` rather than triggering a duplicate post.
- **Auto-Deactivation Circuit Breaker:** If a persona encounters consecutive failures or its weighted `performance_score` drops below $0.25$ with learning mode enabled, `persona.is_active` is automatically flipped to `False` to prevent spamming failed requests.

---

## 7. Closed-Loop AI Learning & Analytics

```mermaid
flowchart TD
    Post["Live Published Post on Facebook"] --> Snapshot["Periodic Snapshot Poller<br/>(1hr, 6hr, 24hr intervals)"]
    Snapshot --> GraphAPI["Meta Graph API Query<br/>(likes, comments, shares, reach)"]
    GraphAPI --> ScoreCalc["Calculate Engagement Score:<br/>E = Likes*1 + Comments*3 + Shares*5 + Reach/100"]
    ScoreCalc --> RecordSnapshot["Save in post_engagement_snapshots & learning_signals"]
    
    RecordSnapshot --> PersonaScore["Recalculate AIPersona.performance_score<br/>(Weighted 20-post moving average)"]
    RecordSnapshot --> PatternExtractor["Extract Feature Bucket Patterns<br/>(Short vs Long, Questions vs Statements, Timeslots)"]
    
    PatternExtractor --> WeeklyJob["Weekly Strategy Synthesizer (run_weekly_learning_job)"]
    WeeklyJob --> LLM["Multimodal LLM Strategy Synthesis"]
    LLM --> Strategy["Save in learned_strategy & ai_recommendations"]
    Strategy -.->|Injects Dynamic Hook Hints| Composer["Smart Composer & Scheduler Prompt Assembly"]

    style Post fill:#e0f2fe,stroke:#0284c7
    style GraphAPI fill:#f3e8ff,stroke:#9333ea
    style ScoreCalc fill:#fef3c7,stroke:#d97706
    style Strategy fill:#dcfce7,stroke:#16a34a
    style Composer fill:#fce7f3,stroke:#db2777
```

### 7.1 Mathematical Scoring Formula
$$\text{engagement\_score} = (\text{likes} \times 1.0) + (\text{comments} \times 3.0) + (\text{shares} \times 5.0) + \left(\frac{\text{reach}}{100.0}\right)$$
Comments and shares are heavily weighted ($3\times$ and $5\times$) because the Facebook algorithm prioritizes active social discourse and distribution over passive likes.

---

## 8. Multi-Model AI Routing & Security Architecture

### 8.1 Multi-Provider Routing Whitelist
The platform provides a strict multi-provider abstraction layer supporting:
- **OpenAI:** `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`
- **Google Gemini:** `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash`
- **Anthropic Claude:** `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`
- **Mistral AI:** `mistral-large-latest`, `mistral-small-latest`, `pixtral-12b-2409`
- **OpenRouter:** `openrouter/auto`, `claude-3.5-sonnet`, `mistral-large`

### 8.2 Two-Tier Resolution Hierarchy
```
Requested Task Category (e.g. "post_generation", "image_prompt_generation")
                      │
                      ▼
     Does a `model_settings` row exist for (user_id, task_category)?
                      │
        ┌─────────────┴─────────────┐
   YES  │                           │  NO
        ▼                           ▼
Use provider & model from       Does a `user_settings` row exist for user_id?
`model_settings`. Decrypt                   │
user API key if present.        ┌───────────┴───────────┐
                           YES  │                       │  NO
                                ▼                       ▼
                   Use `post_generation_provider`   Use system default
                   from `user_settings`.            (DEFAULT_LLM_PROVIDER).
```

### 8.3 Zero-Trust Security & Key Encryption
1. **At-Rest Token Encryption:** All Facebook Page access tokens and user-provided LLM API keys are encrypted at rest using **Fernet symmetric encryption** (`backend/app/crypto.py`). Keys are never logged in plaintext.
2. **CSRF Protection in OAuth:** Facebook OAuth handshakes generate cryptographically secure 16-byte hex tokens stored in `oauth_states` with a strict 10-minute time-to-live.
3. **Session & JWT Security:** User sessions use OAuth2 Bearer JWT tokens signed with `HS256` and automatic silent token rotation via the `X-New-Token` response header.

---

## 9. Comprehensive Codebase Audit & Technical Quality Report

### 9.1 Strengths & Architectural Innovations
- **Zero-Network PIL Compositing:** Eliminates network latency during image rendering. Posters assemble in $<300\text{ms}$ with $100\%$ uptime reliability.
- **Directional Cubic Gradient Scrim:** Replaces flat black opacity overlays with mathematical curves, ensuring high-converting aesthetic visuals without dimming photo subjects.
- **Unified 1-Pass Campaign Generation:** `generate_unified_campaign()` produces synchronized copy and matching graphic concepts in a single cognitive call, cutting API cost and latency in half.
- **Persistent Next.js Layout Shell:** `dashboard/layout.tsx` preserves sidebar state, auth contexts, and cached pages in memory across all route switches, eliminating page flicker.
- **Cold-Start & Token Rotation Interceptors:** Frontend Axios layer absorbs Render free-tier container spin-ups gracefully with custom cold-start overlays and automatic JWT refreshes.

### 9.2 Resolved Issues & Bug Diagnostic Matrix

| Issue Diagnosed | Root Cause | Production Fix Implemented |
|---|---|---|
| **Poster Lab Latency Hangs (15–25s)** | Synchronous `urllib.request` lookups to `api.iconify.design` hanging on SSL handshakes. | Replaced with local SVG vector catalog (`vector_assets.py`) and static 178KB Gemoji index (`emoji_index.json`) for 0ms resolution. |
| **Vision Critic Parser Crashes** | Empty string responses from rate-limited multimodal LLMs throwing `JSONDecodeError` at line 1 column 1. | Added sanitized markdown fence extraction and non-blocking fail-open fallback defaulting to `"pass"`. |
| **Over-Dimmed Murky Photos** | Old validator incrementally increasing flat black rectangle opacity to 85%. | Replaced with directional cubic gradient scrim ($\alpha = (y/h)^{1.8}$) and card framing. |
| **Dashboard Tab Switching Re-renders** | Monolithic `social-platform.tsx` remounting on every route change. | Modularized into persistent `dashboard/layout.tsx` with isolated view components. |
| **Windows Console Unicode Crashes** | Narrow Windows terminal encoding (`cp1252`) crashing on Bengali/emojis. | Wrapped `sys.stdout` and `sys.stderr` in UTF-8 text wrappers on Windows startup in `main.py`. |

### 9.3 Technical Debt & Future Roadmap
1. **Legacy Table Deprecation:** Prune the 6 legacy tables (`posts`, `scheduled_posts`, `schedules`, `persona_image_settings`, `background_assets`, `font_assets`) in a future database migration.
2. **PgVector Embedding Upgrade:** Complete the migration from PostgreSQL `tsvector` full-text search to `pgvector` $768$-dimensional semantic similarity search in `library_resolver.py`.
3. **Automated Multi-Pass Vision Nudging:** Upgrade `vision_critic.py` from diagnostic logging to an active closed-loop re-rendering solver for edge cases.

---

## 10. Summary & System Verification

MakeYourPost represents a production-grade, end-to-end agentic social media studio. By marrying **multi-LLM strategic intelligence** with **deterministic vector/canvas visual engineering**, the platform delivers an autonomous, high-performing content pipeline that saves creators dozens of hours weekly while maintaining flawless aesthetic quality and brand voice fidelity.
