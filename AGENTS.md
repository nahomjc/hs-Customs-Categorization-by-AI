# Impact Logistics (hs-project) — Agent Guide

Use this file as the source of truth for stack, architecture, and **UI consistency**. Prefer existing patterns over inventing new ones.

## Stack
- **Next.js 16.1.6** (App Router), **React 19.2.3**, TypeScript strict
- **ESLint** via `eslint-config-next` (core-web-vitals + typescript) — **not** Biome/Prettier
- **PostgreSQL** (Neon) + **Drizzle ORM** (`drizzle-orm` + `postgres.js`)
- **Tailwind CSS v4** (`@import "tailwindcss"` in `app/globals.css`)
- **Auth**: better-auth (email/password, Brevo emails, admin plugin)
- **Storage**: Cloudflare R2 (`lib/storage/r2.ts`)
- **AI**: OpenRouter (`OPENROUTER_API_KEY`) for classification, extraction, OCR, assistant
- **UI libs**: Tailwind utilities, Radix Dialog, Framer Motion, Sonner toasts — no Mantine / @mesob/ui
- **Validation**: Zod (v4) in `lib/import-cases/` and API helpers
- Package manager: **npm** (`package-lock.json`); a `pnpm-lock.yaml` may exist — prefer npm scripts from `package.json`

## Essential Commands
| Command | What it does |
|---|---|
| `npm run dev` | Dev server on **port 3010** |
| `npm run build` | Next production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run db:generate` | Drizzle Kit generate migrations from schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:introspect` | `drizzle-kit pull` (introspect remote DB) |
| `npm run db:studio` | Drizzle Studio |

## Path Aliases (`@/` → project root)
Examples: `@/app`, `@/components`, `@/db`, `@/lib`, `@/types`, `@/emails`. There is **no** `src/` directory.

## Database
- Client: `db` from `@/db` (`db/index.ts`) — single postgres.js pool (`max: 10`)
- Schema: **hand-written** modules under `db/schema/*.ts`, re-exported from `db/schema/index.ts`
- Config: `drizzle.config.ts` — uses `DATABASE_URL_DIRECT` if set, else `DATABASE_URL`; schema path `./db/schema/index.ts`; migrations out to `./drizzle`
- Prefer editing schema files + `db:generate` / `db:migrate` over ad-hoc SQL for app tables
- Env docs: `docs/DATABASE_URL.md`

## Auth & roles
- better-auth config: `lib/auth/better-auth.ts`; catch-all route `app/api/auth/[...all]/route.ts`
- Session helpers: `getAuthSession` / `getAuthUser` from `@/lib/auth/session`
- App profile table: `public.users` (`db/schema/users.ts`) — ensure via `ensureUserProfile`
- Roles: `admin` | `assessor` | `user` | `client` (`lib/auth/roles.ts`)
  - Staff (`admin` / `assessor` / `user`) → full dashboard workflows
  - `client` → client shipment views (`my-shipments`, client home)
- Middleware (`middleware.ts`): cookie-only gate for `/dashboard`, `/account`, set-password; **API routes are not blocked** — validate session inside handlers
- Edge cannot use the Postgres driver; always re-check auth in layouts / API / server code

## Architecture
- **App Router**: pages under `app/`; dashboard under `app/dashboard/`
- **Server Components by default**; `"use client"` only for interactivity
- **API routes** (`app/api/**/route.ts`) are the primary mutation/read surface for import-cases, account, dashboard, webhooks
- **Server Actions** exist sparingly (e.g. `app/dashboard/users/actions.ts`) — prefer Route Handlers when matching nearby features
- Domain logic lives in `lib/` (especially `lib/import-cases/`, `lib/auth/`, `lib/dashboard/`, `lib/notifications/`, `lib/tracking/`)
- Long-running dashboard work: `maxDuration = 300` (layout + `vercel.json`)
- Notifications: Telegram + SMS Ethiopia; channel settings in DB (Admin → Channels), optional env fallbacks

## Domain (product)
- **Impact Logistics** — HS code categorization / import-case workflow for customs teams
- Core flow: import case → documents → extract lines → match/harmonize → classify (tariff reference first, OpenRouter fallback) → human review/approve → export / tracking
- Do **not** let AI invent HS codes freely; prefer controlled reference lists and exact validation (see `lib/import-cases/`, `lib/classify*`, `lib/hsReference*`)
- Unknown vs non-item should stay distinct (`9999`-style review vs exclude) — do not collapse those meanings

---

## UI consistency (required)

Match the existing dashboard / landing language. Do not introduce a second design system.

### Brand & color
- Product name: **Impact Logistics** (metadata / copy)
- Primary action blue: `#007bff`, hover `#0069d9`
- Neutrals: `gray-*` / `slate-*` for text and borders
- Status colors: use `STATUS_STYLES` / `StatusBadge` from `@/components/dashboard/ui` — extend that map instead of one-off badge palettes
- CSS variables in `app/globals.css` (`--background`, `--accent`, landing `--landing-blue`, etc.) — reuse before adding new tokens

### Dashboard building blocks
Reuse from `@/components/dashboard/ui` and `@/components/dashboard/DashTable`:
- `PageHeader`, `Breadcrumbs`, `StatCard`
- `DashCard`, `DashCardHeader`
- `StatusBadge`, `TruncatedText`
- `DashTable`, `DashTh`, `DashTd`, row helpers

### Layout & shape
- Cards: `rounded-3xl`, soft border `border-slate-200/70`, light shadow (see `DashCard`)
- Inputs / selects: `rounded-xl`, `border-gray-200`, focus `border-[#007bff]` + `ring-[3px] ring-[#007bff]/12`
- Primary buttons: `rounded-xl` or `rounded-full`, `bg-[#007bff] hover:bg-[#0069d9]`, `font-semibold`, white text
- Secondary buttons: white / gray border, same radius family
- Tables: uppercase tracking headers (`text-xs font-semibold uppercase tracking-wider text-gray-500`)

### Feedback & motion
- Toasts: **Sonner** (`toast.success` / `toast.error`) — already mounted in root layout
- Prefer existing motion/components (Framer Motion, landing classes) over new animation libraries

### Landing vs dashboard
- Landing: scope styles under `.landing-page` and existing `landing-*` classes in `globals.css`
- Dashboard: white cards on soft page background; Inter is used in dashboard layout — stay consistent with surrounding screens
- Do not mix landing glass/dot-grid into dashboard tables unless the screen already does

### Copy & empty states
- Short, operational language (customs / logistics)
- Empty states: icon in soft blue tile (`bg-blue-50 text-[#007bff]`), clear title, one primary CTA

### Anti-patterns
- No new component library (Mantine, shadcn defaults, etc.) unless explicitly requested
- No purple-gradient / generic AI-dashboard look
- No raw `<img>` when `next/image` fits
- No one-off hex accents that fight `#007bff`
- Avoid duplicating table/card markup — extend shared primitives

---

## Style conventions (code)
- TypeScript strict; match nearby file quote/indent style (project mixes styles — **follow the file you edit**)
- Prefer `@/` imports
- Validate request bodies (Zod or explicit checks); return `NextResponse.json({ error }, { status })` consistently
- After auth-sensitive mutations, use `router.refresh()` on the client when the UI depends on server data
- Keep secrets in `.env` (see `.env.example`); never commit real keys in docs or samples

## Key directories
```
app/                  # routes, layouts, pages
app/api/              # Route Handlers
components/           # UI (dashboard/, landing/, auth/, account/)
db/schema/            # Drizzle tables
lib/                  # domain + integrations
emails/               # Brevo HTML email templates
docs/                 # setup notes (DB, auth email)
drizzle/              # migrations / meta
```

## Deployment
- **Vercel** (`vercel.json` sets `maxDuration: 300` for `app/**/*`)
- Local app URL: `http://localhost:3010` (`BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL`)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
