---
id: broflo
description: AI-powered subscription gift concierge that tracks people, curates gift ideas, and executes purchases automatically on the user's behalf
status: active
stack: [Next.js 14, NestJS, FastAPI, Prisma, PostgreSQL, TypeScript, Python, Tailwind CSS, shadcn/ui, Stripe, NextAuth.js, Anthropic SDK, Firebase Cloud Messaging, pnpm workspaces, Azure Container Apps, Azure App Service]
live_url: "https://broflo-web.azurewebsites.net"
patterns_used: []
connectors_used: []
last_updated: 2026-07-14
---

# CODEBASE — broflo

## Description

Broflo is a subscription SaaS gift concierge that solves the full gift-giving cycle for busy people. Users build per-person dossiers capturing preferences, sizes, budgets, and wish lists. An event radar surfaces upcoming birthdays and anniversaries with configurable lead-time alerts. An AI layer (Anthropic claude-sonnet-4) curates ranked gift suggestions, and an autopilot mode executes purchases automatically via direct retailer APIs or a browser-agent fallback. Broflo earns on subscription only — no commerce margin, no affiliate revenue. It targets a 85–90% gross margin on three tiers: Free, Pro ($9.99/mo), and Elite ($24.99/mo). Slices S-0 through S-9 are shipped; S-10 (browser agent fallback) through S-16 (white-label shell) are in the roadmap.

## Stack

The repo is a pnpm workspace monorepo with four workspaces:

- **apps/web** — Next.js 14 App Router frontend with Tailwind CSS and shadcn/ui. Server components for data-heavy pages; client components for interactive UI. PWA-capable via next-pwa. Dark mode class-based. Auth via NextAuth.js (JWT + refresh).
- **apps/api** — NestJS TypeScript backend. Hosts the primary REST API. Deployed on Azure App Service. Prisma ORM against Azure PostgreSQL. Stripe subscriptions and payment-vault for autopilot purchases.
- **services/ai** — Python FastAPI microservice. Wraps the Anthropic API (claude-sonnet-4) for gift curation, dossier enrichment, and suggestion ranking. ACR image: `cu2registry.azurecr.io/broflo-ai`.
- **services/browser-agent** — Browser automation fallback (Steel.dev / Browserbase) for purchasing on retailers that have no direct API. Every auto-order has a 2-hour cancel window and a full audit trail.
- **packages/shared** — Internal TypeScript package (`@broflo/shared`) containing shared types, utilities, and brand copy strings consumed by both apps/api and apps/web.

Secrets are stored in Azure Key Vault `cu2-apps-kv`. CI/CD via GitHub Actions following cu2-standards conventions. E2E tests use Playwright (single-browser and cross-browser configs at repo root).

## Reusable Components

- **@broflo/shared types**
  - **path**: `packages/shared/src/types/`
  - **notes**: Domain type definitions (User, Person, Event, Gift, GiftSuggestion) shared between the API and web app. Can be extracted to cu2-shared-lib if the same domain shapes are needed across products.

- **@broflo/shared utils**
  - **path**: `packages/shared/src/utils/`
  - **notes**: General-purpose TypeScript utilities shared across the monorepo. Review before copying — anything purely generic (date formatting, currency, slug generation) is a candidate for promotion to `@cu2/shared-lib`.

- **Brand copy strings**
  - **path**: `packages/shared/src/copy/`
  - **notes**: Centralised copy module for UI strings. Pattern is reusable in any product that wants to separate microcopy from component code.

- **ops-config.yml pattern**
  - **path**: `ops-config.yml`
  - **notes**: Well-structured ops-platform app descriptor with QA checklist, risk fields, and release config. Use as a template when registering a new CU2 app with ops-platform.

- **Playwright monorepo config**
  - **path**: `playwright.config.ts`, `playwright.cross-browser.config.ts`
  - **notes**: Two-config pattern (fast single-browser CI run + full cross-browser sweep) is directly portable to any pnpm-workspace Next.js project.

## Do Not Copy

- **Stripe payment vault logic** (`apps/api`) — stores user payment methods for autopilot purchases; the trust model (user authorises agent spending) is Broflo-specific and must not be reused without explicit security review.
- **Broflo Score gamification engine** — domain-specific scoring algorithm (streaks, levels, badges) tied to gift event history; not generic.
- **Commerce tier routing** (Tier 1 retailer APIs → Tier 2 browser agent fallback) — retailer API credentials, buy-API keys, and the fallback logic are Broflo-specific; do not lift into other products.
- **Subscription tier enforcement middleware** — Free/Pro/Elite gate logic is tightly coupled to Broflo's monetisation model.
- **services/ai prompt templates** — gift-curation and dossier-enrichment prompts are tuned to Broflo's persona and data model; they are not general-purpose AI utilities.
- **Brand voice / copy** (`packages/shared/src/copy/`) — Broflo's "mildly cocky, tongue-in-cheek" voice is intentionally distinct; do not carry it into CU2 fintech products.
- **Azure App Service deploy config** — Broflo targets Azure App Service (not Container Apps like most CU2 products); the deploy scripts are not portable without modification.

## Patterns Used

No formal cu2-standards pat-* slugs have been assigned yet. The following patterns are implemented in practice and should be mapped once the standards catalog is published:

- Monorepo pnpm workspace with shared internal package
- FastAPI AI microservice sidecar (Anthropic SDK)
- ops-platform app descriptor (`ops-config.yml`)
- NextAuth.js JWT auth with refresh tokens
- Stripe subscription + payment vault for agent-executed purchases
- Browser agent fallback for unstructured commerce

## Connectors Used

No formal cu2-standards conn-* slugs assigned yet. Active integrations:

- **Stripe** — subscriptions, payment vault, autopilot purchase execution
- **Anthropic API** — claude-sonnet-4 via services/ai (FastAPI)
- **Firebase Cloud Messaging** — push notifications (PWA, iOS/Android)
- **Amazon Product Advertising API** — Tier 1 retailer (S-7, shipped)
- **Steel.dev / Browserbase** — browser agent fallback (S-10, in roadmap)
- **Azure Key Vault (`cu2-apps-kv`)** — secrets management
