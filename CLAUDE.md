# CLAUDE.md — Broflo

> **Standards:** Read `/Users/kirkdrake/Documents/cu2-standards/CLAUDE.md` for all global CU2 standards.
> This file contains Broflo-specific overrides and context only.

---

## Project

- **Name:** Broflo — AI-powered gift concierge
- **Repo:** `credit-union-2-0-llc/broflo`
- **Phase:** S-0 Walking Skeleton (Foundation)

## Deployed URLs

- **Production web:** https://broflo.ai
- **Production api:** https://broflo-api.azurewebsites.net (Azure App Service)
- Cross-browser E2E runs against these two URLs
- Local dev: web :4000, api :4002, ai :8000

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + Tailwind CSS + shadcn/ui |
| Backend | NestJS + TypeScript strict + Prisma |
| AI Service | Python FastAPI + Anthropic SDK |
| Database | PostgreSQL (Azure) |
| Auth | NextAuth.js (activated in S-1) |
| Payments | Stripe (activated in S-6) |
| Cloud | Azure (App Service, Key Vault `cu2-apps-kv`, Container Registry) |

## Monorepo Structure

```
apps/web          — Next.js frontend (port 3000)
apps/api          — NestJS backend (port 3001)
services/ai       — FastAPI AI service (port 8000)
packages/shared   — Shared types, utils, brand voice copy
docs/             — Slice specs and project docs
```

## Key Rules

- **Broflo is NOT a store** — purchasing agent only, subscription revenue only
- **Brand voice** lives in `packages/shared/src/copy/voice.ts` — no inline UI strings
- **2-hour cancel window** on every order — never remove from default flow
- **Gender language** — default they/them unless user specifies relationship context
- **pnpm workspaces** — no Turborepo
- All secrets in `cu2-apps-kv` Azure Key Vault

## Slice Approach

Build in vertical slices. Each slice is full-stack, deployed, and acceptance-tested before the next begins. Slice docs in `docs/slices/`.
