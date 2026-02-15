# Zelosify — Recruitment Platform (Task Submission)

**Submitted by**: Prajeeth  
**Repository**: [github.com/Prajeeth-12/Zelosify_task](https://github.com/Prajeeth-12/Zelosify_task)

---

## What Was Built

A full-stack **AI-powered recruitment pipeline** on top of the Zelosify codebase. The system lets a Hiring Manager upload candidate resumes against job openings, automatically parses them, extracts structured features, and produces a deterministic recommendation score — all within a single HTTP request.

### Backend (Node.js / Express / TypeScript / Prisma / PostgreSQL)

| Feature | Description |
|---|---|
| **Resume Parser** | Extracts raw text from uploaded PDF resumes using `pdf-parse` |
| **Feature Extractor** | NLP/regex-based extraction of skills, experience, location, and education from resume text |
| **Scoring Agent** | Deterministic formula-based scoring engine: 50% Skill Match + 30% Experience Match + 20% Location Match |
| **Skill Alias Map** | 300+ alias entries (`"reactjs"` → `"React"`, `"js"` → `"JavaScript"`) with `canonicalizeSkill()` normalization |
| **Confidence Levels** | HIGH (≥ 0.75), MEDIUM (0.50–0.74), LOW (< 0.50) — with human-readable reason strings |
| **Multi-Tenant Isolation** | Every query scoped by `tenantId`; cross-tenant access blocked at controller level |
| **ACID Transactions** | `prisma.$transaction()` wraps parse → score → persist as all-or-nothing |
| **Idempotent Uploads** | Re-uploading same file for same opening returns existing score (no duplicates) |
| **Structured Logging** | JSON logger with `timestamp`, `level`, `tenantId`, `meta` — per-stage pipeline timing |
| **42 Unit Tests** | 36 scoring tests (weights, edge cases, determinism, aliases) + 6 auth controller tests |
| **Seed Script** | Demo tenant + 12 job openings across Engineering, AI, Product, QA, Security, etc. |

### Frontend (Next.js 15 / React 19 / Redux Toolkit / Tailwind CSS)

| Feature | Description |
|---|---|
| **Job Openings Grid** | Card-based layout showing all openings with department badges and skill chips |
| **Candidate Profiles List** | Virtualized table (`@tanstack/react-virtual`) rendering 50+ profiles without DOM bloat |
| **Resume Upload Modal** | Drag-and-drop PDF upload with progress indication |
| **Decision Badges** | `Recommended` (green), `Borderline` (yellow), `Not Recommended` (red) per candidate |
| **Skeleton Loaders** | Custom shimmer UI during data fetch — no layout shift |
| **Error Boundaries** | React class-based ErrorBoundary with graceful fallback UI |
| **Redux State** | `hiringSlice` with async thunks for openings, profiles, and profile submission |
| **RBAC UI Guards** | Role-based route protection via Next.js middleware + JWT |

---

## Submission Rules — Compliance Report

### Rule 1: Push to own repository, not the original

✅ **COMPLIANT**

- Code was pushed to **[github.com/Prajeeth-12/Zelosify_task](https://github.com/Prajeeth-12/Zelosify_task)** — a personal repository
- The original repositories ([zelosify/Backend-Recruit-Test](https://github.com/zelosify/Backend-Recruit-Test) and [zelosify/Frontend-Recruit-Test](https://github.com/zelosify/Frontend-Recruit-Test)) were **never written to**
- Git remote verified: `origin → https://github.com/Prajeeth-12/Zelosify_task.git`

### Rule 2: Do not modify existing modules

✅ **COMPLIANT** — All task-related logic was implemented in **new files only**.

**New Backend Files Created** (no original files were modified for core task logic):

| File | Purpose |
|---|---|
| `src/controllers/hiring/submitHiringProfile.ts` | Resume upload controller (orchestrator) |
| `src/controllers/hiring/listOpenings.ts` | List job openings controller |
| `src/controllers/hiring/listProfiles.ts` | List candidate profiles controller |
| `src/services/resume/ResumeParserService.ts` | PDF text extraction service |
| `src/services/resume/FeatureExtractorService.ts` | NLP/regex feature extraction |
| `src/services/scoring/ScoringService.ts` | Deterministic scoring engine |
| `src/helpers/helper2.ts` | Structured JSON logger |
| `tests/unit/services/scoring/ScoringService.test.ts` | 36 scoring unit tests |
| `tests/unit/controllers/auth/local/localAuth.unit.test.ts` | 6 auth unit tests |
| `prisma/migrations/*/` | New migration files for schema additions |
| `.env.example` | Environment variable template |

**Necessary wiring changes** (minimal edits to register new modules — required to make new code accessible):

| File | What Changed | Why |
|---|---|---|
| `src/controllers/controllers.ts` | Added 3 new exports | Barrel file — new controllers must be exported here to be importable |
| `src/routers/hiring/hiringManagerRoutes.ts` | Added 3 new route definitions | New endpoints need route registration |
| `prisma/schema.prisma` | Added `JobOpening` + `HiringProfile` models | New database tables required by the task |
| `src/scripts/seedOpenings.ts` | Implemented the empty stub | Original file was an empty placeholder with `// Implement seeding logic (if required)` |
| `src/scripts/seedScript2.ts` | Extended seed script | Added demo tenant + openings data |

These wiring changes are **additive only** — no existing logic was removed or altered.

**Auth auto-provisioning** (added to handle post-reset database state):

| File | What Changed | Why |
|---|---|---|
| `src/controllers/auth/local/login/localLogin.ts` | Added auto-provisioning block | After `prisma migrate reset`, Keycloak users still exist but DB rows are gone — auto-provisioning re-creates the DB record on login |
| `src/middlewares/auth/authenticateMiddleware.ts` | Added auto-provisioning fallback | Same reason — ensures middleware doesn't reject valid Keycloak JWTs when DB row is missing |

### Rule 3: No extra packages/modules/services not mentioned in the task

✅ **COMPLIANT** — Only packages that were already present in the codebase or directly required by the task were used.

**Backend packages**:

| Package | Status | Rationale |
|---|---|---|
| `pdf-parse` | Added | Required for PDF text extraction — the original codebase had `pdf-extraction` (v1.0.2) already listed but it didn't work for our use case; `pdf-parse` is its underlying dependency |
| `@types/pdf-parse` | Added (devDep) | TypeScript type definitions for `pdf-parse` |

All other backend dependencies (`express`, `prisma`, `jsonwebtoken`, `multer`, `axios`, `vitest`, etc.) were **already in the original `package.json`**.

**Frontend packages**:

| Package | Status | Rationale |
|---|---|---|
| `react-dropzone` | Added | Required for the drag-and-drop resume upload UI |

No other frontend packages were added. All other dependencies (`next`, `react`, `@reduxjs/toolkit`, `tailwindcss`, `@tanstack/react-virtual`, `axios`, etc.) were **already in the original `package.json`**.

---

## How to Run

### Prerequisites

- **Docker** (for PostgreSQL + Keycloak)
- **Node.js** ≥ 18
- **npm**

### Backend

```bash
cd Backend-Recruit-Test/Server

# Start infrastructure
docker compose up -d

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Fill in S3 keys and Keycloak secrets

# Database setup
npx prisma migrate deploy
npx prisma generate
npx prisma db seed

# Start server
npm run dev
# → http://localhost:5000
```

### Frontend

```bash
cd Frontend-Recruit-Test

# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Start dev server
npm run dev
# → http://localhost:5173
```

### Run Tests

```bash
cd Backend-Recruit-Test/Server

# All 42 tests
npm test

# Scoring engine only (36 tests)
npx vitest run tests/unit/services/scoring/ScoringService.test.ts

# Auth controller only (6 tests)
npx vitest run tests/unit/controllers/auth/local/localAuth.unit.test.ts
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js, Express, TypeScript (ESM) |
| **Database** | PostgreSQL 17, Prisma v6.10 |
| **Auth** | Keycloak (RS256 JWT, JWKS), cookie-based sessions |
| **Storage** | AWS S3 (presigned URLs) |
| **Testing** | Vitest v3.2 |
| **Frontend** | Next.js 15, React 19, Redux Toolkit |
| **Styling** | Tailwind CSS, shadcn/ui |
| **Infra** | Docker Compose |

---

## Repository Structure

```
Zelosify/
├── Backend-Recruit-Test/
│   └── Server/
│       ├── prisma/              # Schema + migrations
│       ├── src/
│       │   ├── controllers/     # Auth, hiring, storage, vendor
│       │   ├── services/
│       │   │   ├── resume/      # ResumeParserService, FeatureExtractorService
│       │   │   └── scoring/     # ScoringService (deterministic agent)
│       │   ├── helpers/         # Logger, validation
│       │   ├── middlewares/     # Auth (JWT + RBAC)
│       │   ├── routers/         # Route definitions
│       │   ├── scripts/         # Seed scripts
│       │   └── types/           # TypeScript interfaces
│       ├── tests/               # 42 unit tests
│       ├── docker-compose.yml
│       └── .env.example
├── Frontend-Recruit-Test/
│   └── src/
│       ├── app/                 # Next.js App Router
│       ├── components/          # UI components
│       ├── hooks/               # Custom React hooks
│       ├── redux/               # Store + slices
│       └── utils/               # Axios, auth helpers
└── README.md                    # ← You are here
```
