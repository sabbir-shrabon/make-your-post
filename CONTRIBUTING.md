# Contributing to AutoPoster Agentic AI

Thank you for your interest in contributing to **AutoPoster Agentic AI**! We welcome contributions of all kinds, from bug fixes and security improvements to new AI persona models and poster templates.

---

## 🛠️ Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/auto_poster_agentic_ai.git
cd auto_poster_agentic_ai
```

### 2. Backend Setup (FastAPI)
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Fill in your DATABASE_URL, SECRET_KEY, etc.
uvicorn app.main:app --reload
```

### 3. Frontend Setup (Next.js 14)
```bash
cd ../frontend
npm install
cp .env.example .env.local
npm run dev
```

---

## 📋 Contribution Guidelines

1. **Create a Topic Branch**:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```
2. **Write Clean, Documented Code**:
   - Backend follows PEP 8 standards with full type annotations.
   - Frontend uses TypeScript and Tailwind CSS with reusable components.
3. **Verify Before Submitting**:
   - Backend verification: `python -m pytest`
   - Frontend verification: `npm run build`
4. **Open a Pull Request**:
   - Use a clear title and fill out the provided PR template.

---

## 🔒 Security Vulnerabilities

If you discover a security vulnerability, please refer to our [SECURITY.md](SECURITY.md) policy and report it responsibly rather than opening a public issue.
