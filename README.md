# Zelosify — Recruitment Platform (Task Submission)

**Submitted by**: Prajeeth  
**Repository**: [github.com/Prajeeth-12/Zelosify_task](https://github.com/Prajeeth-12/Zelosify_task)

---

## The Task

I was given an existing Zelosify recruitment platform codebase (backend + frontend) and tasked with building an **AI-powered hiring pipeline** on top of it. The task required me to implement a system where a Hiring Manager can upload candidate resumes against job openings, and the system automatically parses, extracts features, scores, and recommends candidates — all through a deterministic scoring agent.

The task came with **3 strict rules** I had to follow (detailed below in the [Submission Rules](#submission-rules-i-followed) section).

---

## How I Completed It

### Backend (Node.js / Express / TypeScript / Prisma / PostgreSQL)

| What I Implemented | Details |
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

| What I Implemented | Details |
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

## Submission Rules I Followed

The task had 3 strict rules. Here's how I followed each one:

### Rule 1: Push to my own repository, not the original

I pushed all my work to my personal repository at **[github.com/Prajeeth-12/Zelosify_task](https://github.com/Prajeeth-12/Zelosify_task)**. I did not push to or modify the original repositories ([zelosify/Backend-Recruit-Test](https://github.com/zelosify/Backend-Recruit-Test) and [zelosify/Frontend-Recruit-Test](https://github.com/zelosify/Frontend-Recruit-Test)) in any way. My git remote points only to my own repo: `origin → https://github.com/Prajeeth-12/Zelosify_task.git`.

### Rule 2: Do not modify existing modules

All the core task logic I wrote lives in **new files only**. I did not change any existing business logic.

**New backend files I created:**

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

**New frontend files I created:**

| File | Purpose |
|---|---|
| `src/redux/features/hiringSlice.js` | Redux slice for hiring state (openings, profiles, upload) |
| `src/hooks/Dashboard/Vendor/useHiring.js` | Custom hook wrapping hiring dispatch/selectors |
| `src/components/UserDashboardPage/Home/OpeningsLayout.jsx` | Job openings grid with skeleton loader |
| `src/components/UserDashboardPage/IT_VENDOR/ProfilesLayout.jsx` | Virtualized candidate profiles list |
| `src/components/UserDashboardPage/IT_VENDOR/UploadResumeModal.jsx` | Drag-and-drop PDF upload modal |
| `src/components/UserDashboardPage/Home/OpeningsSkeleton.jsx` | Shimmer skeleton for openings |
| `src/components/UserDashboardPage/IT_VENDOR/ProfilesSkeleton.jsx` | Shimmer skeleton for profiles |
| `src/components/common/ErrorBoundary.jsx` | React error boundary with fallback UI |
| `src/app/(UserDashBoard)/user/openings/page.jsx` | Openings page route |
| `src/app/(UserDashBoard)/user/profiles/page.jsx` | Profiles page route |
| `.env.example` | Environment variable template |

**Minimal wiring changes I made** (purely additive — needed to register my new modules into the app):

| File | What I Changed | Why |
|---|---|---|
| `src/controllers/controllers.ts` | Added 3 new exports | This is a barrel file — I had to export my new controllers here so they could be imported by the router |
| `src/routers/hiring/hiringManagerRoutes.ts` | Added 3 new route definitions | My new endpoints needed to be registered in the router |
| `prisma/schema.prisma` | Added `JobOpening` + `HiringProfile` models | I needed new database tables to store the task data |
| `src/scripts/seedOpenings.ts` | Implemented the empty stub | The original file was a placeholder with just `// Implement seeding logic (if required)` — I filled it in |
| `src/scripts/seedScript2.ts` | Extended the seed script | Added demo tenant + openings seed data |
| `src/redux/core/store.js` | Added hiring reducer import | My new `hiringSlice` needed to be registered in the Redux store |
| `src/components/UserDashboardPage/SideBar/Routes/ItemRoutes.jsx` | Added sidebar entries for ADMIN + HIRING_MANAGER | My new pages needed navigation links |

I did not remove or alter any existing logic in these files — every change was additive.

**Auth auto-provisioning I added** (to handle database resets):

| File | What I Changed | Why |
|---|---|---|
| `src/controllers/auth/local/login/localLogin.ts` | Added auto-provisioning block | After running `prisma migrate reset`, Keycloak users still exist but their DB rows are gone — my auto-provisioning code re-creates the DB record on login so the app doesn't break |
| `src/middlewares/auth/authenticateMiddleware.ts` | Added auto-provisioning fallback | Same reason — this ensures the middleware doesn't reject valid Keycloak JWTs when the matching DB row is missing after a reset |

### Rule 3: Do not use extra packages/modules/services not mentioned in the task

I used only packages that were already present in the original codebase or that were directly necessary for the task functionality.

**Backend packages I added:**

| Package | Why I Added It |
|---|---|
| `pdf-parse` | I needed this for PDF text extraction. The original codebase already had `pdf-extraction` (v1.0.2) listed as a dependency, but it didn't work for my use case. `pdf-parse` is the underlying library that `pdf-extraction` wraps, so it's not an unrelated addition |
| `@types/pdf-parse` | TypeScript type definitions for `pdf-parse` (devDependency only) |

**Frontend package I added:**

| Package | Why I Added It |
|---|---|
| `react-dropzone` | I needed this for the drag-and-drop resume upload UI in the upload modal |

Everything else I used — `express`, `prisma`, `jsonwebtoken`, `multer`, `axios`, `vitest`, `next`, `react`, `@reduxjs/toolkit`, `tailwindcss`, `@tanstack/react-virtual`, etc. — was **already in the original `package.json`** files.

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
