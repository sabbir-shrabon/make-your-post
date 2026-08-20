<div align="center">

  <img src="frontend/public/logo.png" alt="AutoPoster AI Logo" width="120" />

  # AutoPoster Agentic AI

  **Autonomous Social Media Operating System powered by Multi-Agent AI, Canva-Grade Poster Generation, and Intelligent Social Scheduling.**

  [![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
  [![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Python](https://img.shields.io/badge/Python_3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
  [![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
  [![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

  [Live Demo](https://autopost-woad.vercel.app) • [API Documentation](https://autopost-qwgw.onrender.com/docs) • [Architecture Guide](docs/architecture.md)

</div>

---

## 🌟 Overview

**AutoPoster Agentic AI** is a full-stack, enterprise-ready marketing automation engine. It combines autonomous LLM personas, multi-modal image composition, real-time competitor trend tracking, and multi-channel scheduling into a cohesive platform.

Whether you run a digital brand, manage agency clients, or build high-volume content pipelines, AutoPoster autonomously plans, writes, designs, and publishes viral social content on autopilot.

---

## ✨ Key Capabilities

<table>
  <tr>
    <td width="50%">
      <h3>🤖 Autonomous AI Personas</h3>
      <ul>
        <li><b>Self-Learning Loops:</b> Learns from engagement performance (likes, shares, comments) to continuously refine post tone and structure.</li>
        <li><b>Custom Tone Archetypes:</b> Configure niche descriptions, tone tags (e.g. <i>Authoritative, Bold, Witty</i>), custom rules, and multi-lingual output.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>🎨 Canva-Grade Poster Studio</h3>
      <ul>
        <li><b>Deterministic Visual Composition:</b> Sub-100ms multi-layer typography, directional gradient scrims, badges, and avatars.</li>
        <li><b>Dynamic Background Resolution:</b> Stock photography via Pexels/Unsplash, Cat API fallback, and AI generative art.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🧠 Multi-LLM Orchestration</h3>
      <ul>
        <li><b>Provider Flexibility:</b> Native integration with <b>Google Gemini</b>, <b>OpenAI GPT-4o</b>, <b>Anthropic Claude</b>, and <b>Mistral AI</b>.</li>
        <li><b>Cost-Optimized Fallbacks:</b> Automatic failover and per-user custom API key configuration.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>🔒 Hardened Security Architecture</h3>
      <ul>
        <li><b>SSRF Defense Firewall:</b> Blocks unauthorized internal IP probing and cloud metadata traversal.</li>
        <li><b>Anti-Brute Force Protection:</b> SlowAPI rate limiting on auth and generative routes.</li>
        <li><b>Zero-Knowledge Tokens:</b> Encrypted storage for Facebook Graph API access tokens.</li>
      </ul>
    </td>
  </tr>
</table>

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client ["Frontend (Next.js 14 + TailwindCSS)"]
        UI[Dashboard / Poster Studio / Schedule Manager]
        Axios[Axios Auth Interceptor + Token State]
    end

    subgraph Server ["Backend (FastAPI Engine)"]
        Router[API Gateway & Rate Limiter]
        AuthMgr[JWT Auth & Session Guardian]
        PersonaEngine[Persona & Learning Pipeline]
        PosterRenderer[Pillow / Cairo Typography Engine]
        Scheduler[APScheduler Recurring Worker]
    end

    subgraph AI_Providers ["LLM & Vision Services"]
        Gemini[Google Gemini 2.0 / 1.5]
        OpenAI[OpenAI GPT-4o]
        Claude[Anthropic Claude 3.5]
        Mistral[Mistral AI]
    end

    subgraph Storage ["Cloud Infrastructure"]
        Postgres[(Supabase PostgreSQL)]
        S3Bucket[(Supabase Storage: Generated Images)]
        MetaGraph[Meta Facebook Graph API]
    end

    Client <-->|REST API + Bearer JWT| Router
    Router --> AuthMgr
    Router --> PersonaEngine
    Router --> PosterRenderer
    
    PersonaEngine --> AI_Providers
    PosterRenderer --> S3Bucket
    Scheduler --> PersonaEngine
    Scheduler --> MetaGraph
    AuthMgr --> Postgres
    PersonaEngine --> Postgres
```

---

## 📁 Repository Structure

```text
auto_poster_agentic_ai/
├── .github/                      # GitHub issue templates, PR template & workflows
│   ├── ISSUE_TEMPLATE/           # Bug report & feature request templates
│   └── PULL_REQUEST_TEMPLATE.md  # Standardized PR review checklist
├── backend/                      # FastAPI Python Application
│   ├── app/                      # Application core
│   │   ├── routers/              # Modular API routes (auth, poster, brand, schedules)
│   │   ├── services/             # Rendering engines, SSRF firewall, scheduling logic
│   │   ├── providers/            # Multi-model LLM abstraction adapters
│   │   ├── config.py             # App configuration & secure environment loader
│   │   ├── crypto.py             # Fernet cryptographic token encryption
│   │   └── models.py             # SQLAlchemy database ORM models
│   ├── migrations/               # SQL schema migrations & enable_rls.sql
│   ├── scripts/                  # Maintenance & helper scripts
│   ├── tests/                    # Security & unit test suites
│   └── requirements.txt          # Python dependencies
├── frontend/                     # Next.js 14 React Application (App Router)
│   ├── src/
│   │   ├── app/                  # Route pages (Dashboard, Studio, Memes, Settings)
│   │   ├── components/           # High-polish UI design system & visual editor
│   │   ├── contexts/             # AuthContext & AppContext state providers
│   │   └── lib/                  # Centralized Axios client & API utilities
│   └── package.json              # Node.js dependencies & scripts
├── docs/                         # Technical documentation & architecture deep dives
│   ├── architecture.md           # Detailed component architecture & flowcharts
│   └── assets/                   # Architecture diagrams and showcase graphics
├── CONTRIBUTING.md               # Contribution guidelines & development workflow
├── LICENSE                       # MIT License
├── render.yaml                   # Backend Render deployment blueprint
├── vercel.json                   # Frontend Vercel deployment blueprint
└── README.md                     # Project overview & quickstart guide
```

---

## 🚀 Quickstart Guide

### Prerequisites
- **Python:** 3.11 or higher
- **Node.js:** 18.x or 20.x
- **Database:** PostgreSQL (Supabase recommended)

---

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
```

Start the FastAPI development server:
```bash
uvicorn app.main:app --reload --port 8000
```
* Interactive API documentation: `http://localhost:8000/docs`

---

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Configure environment variables
cp .env.example .env.local
```

Start the Next.js development server:
```bash
npm run dev
```
* Web application UI: `http://localhost:3000`

---

## ⚙️ Environment Variables Reference

### Backend (`backend/.env`)
| Variable | Description | Required | Default / Example |
| :--- | :--- | :---: | :--- |
| `DATABASE_URL` | PostgreSQL connection string (Transaction Pooler) | **Yes** | `postgresql://user:pass@host:6543/postgres` |
| `SECRET_KEY` | 64-char random hex key for JWT signing | **Yes** | Generate via `secrets.token_hex(32)` |
| `CRON_SECRET` | Secret token for background scheduler endpoints | **Yes** | Generate via `secrets.token_hex(32)` |
| `FACEBOOK_TOKEN_ENCRYPTION_KEY` | Fernet key for encrypting Page tokens | **Yes** | Generate via `secrets.token_hex(32)` |
| `FRONTEND_URL` | Trusted origin for CORS and callbacks | **Yes** | `http://localhost:3000` |
| `SUPABASE_URL` | Supabase project API URL | Optional | `https://your-ref.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service-role key for storage | Optional | `eyJhbGciOi...` |
| `OPENAI_API_KEY` | OpenAI platform API key | Optional | `sk-...` |
| `GEMINI_API_KEY` | Google Gemini AI API key | Optional | `AIzaSy...` |
| `MISTRAL_API_KEY` | Mistral AI API key | Optional | `...` |
| `PEXELS_API_KEY` | Pexels stock photo search key | Optional | `...` |

### Frontend (`frontend/.env.local`)
| Variable | Description | Required | Default |
| :--- | :--- | :---: | :--- |
| `NEXT_PUBLIC_API_URL` | Canonical FastAPI backend endpoint | **Yes** | `http://localhost:8000` |
| `NEXT_PUBLIC_FACEBOOK_APP_ID` | Meta App ID for OAuth Login popup | Optional | `your-facebook-app-id` |

---

## 🧪 Testing & Quality Assurance

Run the security and integration test suite:
```bash
cd backend
python -m pytest tests/
```

Verify frontend build and type checking:
```bash
cd frontend
npm run build
```

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

<div align="center">
  <sub>Built with ❤️ by Sabbir Shrabon and the open-source community.</sub>
</div>
