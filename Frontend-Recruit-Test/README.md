# Zelosify — Recruitment Platform Frontend

> Next.js 15 hiring dashboard with **table virtualization**, **skeleton loaders**, **decision badges**, and **Redux Toolkit** state management.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment config
cp .env.example .env

# 3. Start development server
npm run dev
# → App runs on http://localhost:5173
```

> **Prerequisite**: The backend server must be running on `http://localhost:5000` (see Backend README).

---

## Key Frontend Features

| Feature | Implementation |
|---|---|
| **Table Virtualization** | `@tanstack/react-virtual` renders 50+ candidate profiles without DOM bloat — estimated row heights with overscan of 8 |
| **Skeleton Loaders** | Custom shimmer UI (`OpeningsSkeleton`, `ProfilesSkeleton`) during data fetch — no layout shift |
| **Decision Badges** | `Recommended` (≥ 0.75, green), `Borderline` (0.50–0.74, yellow), `Not Recommended` (< 0.50, red) — rendered alongside confidence badges |
| **Error Boundaries** | React class-based `ErrorBoundary` wraps all dashboard routes with graceful fallback UI |
| **Empty States** | `EmptyState` component for zero-data scenarios (no openings, no profiles) |
| **Redux Toolkit** | `authSlice` + `hiringSlice` with async thunks (`fetchOpenings`, `fetchProfiles`, `submitProfile`) |
| **Responsive Layout** | Sidebar + header dashboard layout with mobile menu support |
| **RBAC UI Guards** | Role-based route protection via middleware + Keycloak JWT |

---

## Project Structure

```
src/
├── app/                     # Next.js App Router pages
│   ├── (Landing)/           # Public pages + auth forms
│   └── (UserDashBoard)/     # Protected dashboard routes
│       ├── business-user/   # Business user views
│       ├── user/            # Hiring manager views (openings, profiles, upload)
│       └── vendor/          # Vendor views
├── components/
│   ├── Auth/                # Login components
│   ├── common/              # EmptyState, ErrorComponent
│   ├── LandingPage/         # Navbar, mobile menu
│   ├── UI/                  # Shared UI (ProfileImage, loaders, shadcn)
│   └── UserDashboardPage/   # Dashboard-specific components
│       ├── Home/            # Job openings grid + skeleton
│       └── IT_VENDOR/       # Profiles list (virtualized) + upload modal
├── hooks/                   # Custom React hooks (auth, dashboard, UI)
├── lib/                     # Utility functions
├── pages/                   # Page-level layout components
├── redux/
│   ├── core/                # Store configuration
│   └── features/            # authSlice, hiringSlice
├── styles/                  # Tailwind globals
└── utils/                   # Axios instance, auth helpers, common utilities
```

---

## Tech Stack

- **Next.js 15.3.4** — App Router with server/client component architecture
- **React 19** — Latest concurrent features
- **Redux Toolkit** — Centralized state with async thunks
- **Tailwind CSS** — Utility-first styling
- **shadcn/ui** — Accessible component primitives
- **@tanstack/react-virtual** — Performant list virtualization
- **Axios** — HTTP client with interceptors

---

## Environment Variables

Copy `.env.example` to `.env`:

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Backend API base URL | `http://localhost:5000/api/v1` |
