# Zelosify — Recruitment Platform Backend

> AI-powered candidate screening with **deterministic scoring**, **multi-tenant isolation**, and **production-grade observability**.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Deterministic AI Agent — Design Rationale](#deterministic-ai-agent--design-rationale)
- [Resume Processing Pipeline](#resume-processing-pipeline)
- [Production-Grade Features](#production-grade-features)
- [Observability & Structured Logging](#observability--structured-logging)
- [Test Suite](#test-suite)
- [Database & Seeding](#database--seeding)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)

---

## Quick Start

```bash
# 1. Start infrastructure (PostgreSQL + Keycloak)
docker compose up -d

# 2. Install dependencies
npm install

# 3. Copy environment config
cp .env.example .env
# → Fill in AWS S3 keys and Keycloak secrets (see Environment Variables section)

# 4. Apply database migrations
npx prisma migrate deploy

# 5. Generate Prisma client
npx prisma generate

# 6. Seed demo data (tenant → openings)
npx prisma db seed

# 7. Start the dev server
npm run dev
# → Server runs on http://localhost:5000
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Express API                         │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────────────┐ │
│  │   Auth   │  │   Hiring      │  │   Storage (S3)       │ │
│  │Middleware │→ │  Controller   │→ │   Upload Service     │ │
│  │(Keycloak)│  │(Orchestrator) │  │                      │ │
│  └──────────┘  └──────┬────────┘  └──────────────────────┘ │
│                       │                                     │
│          ┌────────────┼────────────┐                        │
│          ▼            ▼            ▼                        │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐                 │
│  │  Resume  │  │  Feature  │  │ Scoring  │                 │
│  │  Parser  │  │ Extractor │  │  Agent   │                 │
│  │(pdf-parse)│ │(NLP/Regex)│  │(50/30/20)│                 │
│  └──────────┘  └───────────┘  └──────────┘                 │
│                       │                                     │
│              ┌────────▼────────┐                            │
│              │ Prisma ORM      │                            │
│              │ $transaction()  │                            │
│              │ (ACID writes)   │                            │
│              └────────┬────────┘                            │
│                       ▼                                     │
│              ┌─────────────────┐                            │
│              │  PostgreSQL     │                            │
│              │  (Multi-tenant) │                            │
│              └─────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle**: The controller is a thin orchestrator — all business logic lives in dedicated service classes (`ResumeParserService`, `FeatureExtractorService`, `ScoringService`).

---

## Deterministic AI Agent — Design Rationale

The candidate recommendation engine uses a **deterministic, formula-based scoring agent** rather than delegating scoring to an LLM. This was an intentional architectural choice driven by three hard requirements:

### 1. Performance SLAs — Sub-100 ms Scoring

| Approach | Typical Latency | Our Observed Latency |
|---|---|---|
| LLM API call (GPT-4) | 800 ms – 5 s | N/A |
| Deterministic Agent | < 1 ms (compute) | **~35–98 ms** (incl. DB I/O) |

The hiring dashboard returns a scored recommendation **within the same HTTP request** that uploads a resume. The scoring agent runs inside a **Prisma interactive transaction** alongside DB writes, keeping total round-trip (parse → extract → score → persist → respond) under the 2000 ms P95 SLA.

### 2. Auditability & Reproducibility

- **Same inputs → same outputs**, every time — verified by a dedicated determinism test (100 iterations, bitwise equality assertion)
- **Transparent formula**: $FinalScore = 0.5 \times SkillMatch + 0.3 \times ExperienceMatch + 0.2 \times LocationMatch$
- **Human-readable `reason` string** breaks down exactly which skills matched, experience ratio, and location alignment

### 3. Cost Predictability

The deterministic agent has **zero marginal cost** — pure CPU arithmetic, no external API calls. For a multi-tenant platform processing thousands of candidates, this matters.

### 4. When We Would Use an LLM

The architecture is designed so an LLM stage can feed structured data **into** the deterministic scoring agent:
- **Resume parsing** → structured feature extraction
- **Semantic skill matching** → beyond alias-table normalization
- **Cover letter analysis** → soft-skill evaluation

---

## Resume Processing Pipeline

The pipeline executes in three stages within a single request:

```
PDF Upload  →  Stage 1: Parse  →  Stage 2: Extract  →  Stage 3: Score  →  Persist
               (pdf-parse)        (NLP/Regex)           (50/30/20)        ($transaction)
```

| Stage | Service | Output |
|---|---|---|
| **1. Parse** | `ResumeParserService` | Raw text from PDF buffer via `pdf-parse` |
| **2. Extract** | `FeatureExtractorService` | Structured features: skills (300+ alias map), experience, location, education |
| **3. Score** | `ScoringService` | `finalScore`, `confidence` (HIGH/MEDIUM/LOW), `reason` string |

**Skill Normalization**: The `SKILL_ALIAS_MAP` (300+ entries) + `canonicalizeSkill()` function handles variations like `"reactjs"` → `"React"`, `"js"` → `"JavaScript"`, `"tf"` → `"TensorFlow"`, plus a space-stripped fallback for compound names.

**Pipeline Timing**: Each stage is instrumented with millisecond-precision timestamps (`parsingTimeMs`, `extractionTimeMs`, `matchingTimeMs`), logged as structured JSON for observability.

---

## Production-Grade Features

| Feature | Implementation | Proof Location |
|---|---|---|
| **Multi-Tenant Isolation** | Every query includes `WHERE tenantId = ?` — enforced at controller level; cross-tenant check in `submitHiringProfile` | `src/controllers/hiring/submitHiringProfile.ts` |
| **ACID Transactions** | `prisma.$transaction()` wraps create → score → update as all-or-nothing | `submitHiringProfile.ts` (interactive transaction) |
| **Structured JSON Logging** | `logger.info/warn/error` with `timestamp`, `level`, `tenantId`, `meta` — no raw `console.log` | `src/helpers/helper2.ts`, every controller |
| **Idempotent Uploads** | Re-uploading same file for same opening returns existing score (HTTP 200) | `submitHiringProfile.ts` (idempotency check) |
| **Pipeline Observability** | `recommendationLatencyMs` stored per profile; per-stage timing in logs | `HiringProfile` model + structured logs |
| **RBAC** | JWT-based `authorizeHiringOrAdmin` checks `HIRING_MANAGER` OR `ADMIN` roles | `src/middlewares/auth/` |
| **Error Boundaries** | Global error handler uses structured `logger.error` with stack traces | `src/index.ts` |

---

## Observability & Structured Logging

Every log entry is machine-parseable JSON:

```json
{
  "timestamp": "2026-02-15T18:20:52.607Z",
  "level": "INFO",
  "message": "Pipeline complete: upload scored",
  "tenantId": "086947ad-...",
  "meta": {
    "profileId": "735b6fa0-...",
    "startTime": "2026-02-15T18:20:51.481Z",
    "parsingTimeMs": 1027.04,
    "matchingTimeMs": 98.38,
    "totalLatencyMs": 1125.42,
    "finalScore": 0.55,
    "confidence": "MEDIUM"
  }
}
```

**Key observability points**:
- `recommendationLatencyMs` — persisted on every `HiringProfile` record for P95/P99 SLA tracking
- Per-stage timing (`parsingTimeMs`, `extractionTimeMs`, `matchingTimeMs`) — logged for bottleneck identification
- `tenantId` on every log line — enables per-tenant log filtering in production

---

## Test Suite

```bash
# Run all 42 tests
npm test

# Scoring engine only (36 tests)
npx vitest run tests/unit/services/scoring/ScoringService.test.ts

# Auth controller only (6 tests)
npx vitest run tests/unit/controllers/auth/local/localAuth.unit.test.ts
```

**Results**: **42 tests passing** (36 scoring + 6 auth), < 1 s execution time.

### Scoring Tests Cover:

- Mandatory weighting formula (50% / 30% / 20%)
- Experience boundary conditions (0, exact, under, over, negative)
- Skill overlap edge cases (none, partial, full, superset, case/whitespace normalization)
- Location match logic (exact, mismatch, empty constraints, alias resolution)
- Confidence thresholds (HIGH ≥ 0.75, MEDIUM ≥ 0.45, LOW < 0.45)
- **Determinism** — 100 repeated invocations, bitwise equality assertion
- Skill alias canonicalization (`canonicalizeSkill` function)

---

## Database & Seeding

```bash
# Reset database (drop + re-migrate)
npx prisma migrate reset --force

# Seed demo tenant + 12 job openings
npx prisma db seed

# Open Prisma Studio (GUI)
npx prisma studio
```

**Seed data**: 1 demo tenant → 12 job openings across Engineering, AI & Data, Product, QA, Security, Documentation, Mobile, and Cloud departments.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing temporary JWT tokens |
| `ENCRYPTION_ALGORITHM` | `aes-256-gcm` |
| `ENCRYPTION_KEY` | 32-byte hex key for field encryption |
| `SESSION_SECRET` | Express session secret |
| `STORAGE_PROVIDER` | `aws` |
| `S3_AWS_REGION` | AWS region (e.g. `us-east-1`) |
| `S3_ACCESS_KEY_ID` | AWS access key |
| `S3_SECRET_ACCESS_KEY` | AWS secret key |
| `S3_BUCKET_NAME` | S3 bucket name |
| `KEYCLOAK_URL` | Keycloak base URL |
| `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` | Keycloak admin credentials |
| `KEYCLOAK_REALM` / `KEYCLOAK_CLIENT_ID` | Realm and client configuration |
| `KEYCLOAK_CLIENT_SECRET` | From Keycloak UI after startup |
| `KEYCLOAK_RS256_SIG` | RS256 public key from Keycloak realm keys |
| `PORT` | Server port (default: `5000`) |

---

## Project Structure

```
Server/
├── prisma/                  # Schema + migrations
├── src/
│   ├── index.ts             # Express app entry point
│   ├── config/              # Keycloak, Multer, Prisma clients
│   ├── controllers/         # Thin orchestrators (auth, hiring, storage, vendor)
│   ├── helpers/             # Structured logger, validation helpers
│   ├── middlewares/         # Auth middleware (JWT verification, RBAC)
│   ├── routers/             # Express route definitions
│   ├── scripts/             # Database seed scripts
│   ├── services/
│   │   ├── resume/          # ResumeParserService, FeatureExtractorService
│   │   ├── scoring/         # ScoringService (deterministic 50/30/20 agent)
│   │   ├── storage/         # AWS S3 abstraction layer
│   │   └── upload/          # File upload coordination
│   ├── types/               # TypeScript type definitions
│   └── utils/               # JWT, encryption, Keycloak, RBAC utilities
├── tests/
│   └── unit/                # Vitest unit tests (42 tests)
├── docker-compose.yml       # PostgreSQL + Keycloak
├── .env.example             # Environment variable template
└── package.json
```
