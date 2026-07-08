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

## Azure Ownership — route changes to the right place

Broflo's Azure footprint spans **two** resource groups with two different owners. Editing the wrong one silently fails (pool resources revert on the next IaC deploy). Route by which RG the resource lives in:

- **App stack — `rg-broflo` (edit directly, you have Contributor):**
  `broflo-db`, `broflo-api`, `broflo-web`, `broflo-redis`, `cae-broflo`, `broflo-ai`, storage, certs, app secrets in `cu2-apps-kv`. Change these directly with `az` / the portal / this repo's deploy.

- **Shared consumer-prod pool — `rg-cu2-consumer-prod` (IaC-managed, do NOT edit directly):**
  `kv-cu2-pool-broflo` (holds `pii-cmk-broflo`), `mi-pool-broflo`, `nsg-app-broflo`, and the `broflo` schema on the shared `postgres-cu2-pool` server. These are defined in Infrastructure-as-Code in **`credit-union-2-0-llc/cu2-platform`** (`pool-tenants/broflo.json` + `bicep/consumer-prod.bicep` / `pool-server.bicep` / `pool-tenant-kv.bicep`). **Portal/CLI edits here are reverted on the next deploy.**
  To change them: open a PR against `cu2-platform`; merge to main auto-applies via the `deploy-consumer-prod.yml` pipeline (which runs with the deployment identity — you do not need direct Azure access to `rg-cu2-consumer-prod`).

> Rule of thumb: **app data/config → `rg-broflo` directly. Pool KV / identity / network / PII CMK → cu2-platform PR.** If unsure which RG a resource is in: `az resource show --ids <id> --query resourceGroup`.

## Key Rules

- **Broflo is NOT a store** — purchasing agent only, subscription revenue only
- **Brand voice** lives in `packages/shared/src/copy/voice.ts` — no inline UI strings
- **2-hour cancel window** on every order — never remove from default flow
- **Gender language** — default they/them unless user specifies relationship context
- **pnpm workspaces** — no Turborepo
- All secrets in `cu2-apps-kv` Azure Key Vault

## Scheduler Feature Flags

Expensive background schedulers are gated behind env vars to prevent idle cost burn:

| Env Var | Default | What it controls |
|---------|---------|------------------|
| `AUTOPILOT_ENABLED` | `false` (off) | Daily AI suggestion generation (Claude + Exa API costs) |
| `ORDER_POLLING_ENABLED` | `false` (off) | Retailer order status polling (every 15 min when enabled) |
| `REMINDERS_ENABLED` | `true` (on) | Daily reminder generation (DB-only, no external API cost) |

Set `AUTOPILOT_ENABLED=true` and `ORDER_POLLING_ENABLED=true` in Azure App Service config when real users onboard.

## Slice Approach

Build in vertical slices. Each slice is full-stack, deployed, and acceptance-tested before the next begins. Slice docs in `docs/slices/`.
