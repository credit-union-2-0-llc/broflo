# CODEBASE.md — credit-union-2-0-llc/broflo

## Purpose
Broflo is an AI-powered gift concierge purchasing agent, not a storefront. It tracks user relationships, curates personalized gift suggestions via Anthropic AI, and executes purchases on retailers' behalf. The product targets users seeking automated, thoughtful gifting with zero inventory or commerce margin risk.

## Stack
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, shadcn/ui, next-pwa
- **Backend:** Node.js/TypeScript (NestJS), FastAPI (Python AI services)
- **Data:** PostgreSQL (Azure), Prisma ORM
- **Auth/Payments:** NextAuth.js, Stripe (Subscriptions + Payment Vault)
- **Infrastructure:** Azure (App Service, Key Vault, Container Registry), GitHub Actions CI/CD

## Entry Points
- **Development:** `pnpm dev` runs the monorepo workspace (Next.js web app and NestJS API).
- **Production:** Deployed via GitHub Actions to Azure App Service (`broflo-dev` / `broflo-prod`).
- **AI Services:** FastAPI container in Azure Container Apps, invoked by backend for gift curation.

## Key Directories
- `/apps/web`: Next.js frontend application (App Router).
- `/apps/api`: NestJS backend API handling auth, user logic, and Stripe integration.
- `/services/ai`: Python FastAPI service for Anthropic API interactions.
- `/packages/shared`: Shared TypeScript types, utilities, and brand voice copy.
- `/docs/slices`: Vertical slice documentation (S-0 through S-16) with definitions of done.

## External Dependencies
- **Anthropic API:** `claude-sonnet-4` for gift curation and dossier enrichment.
- **Stripe:** Subscription billing, payment vault, and checkout sessions.
- **Retailer APIs/Tier 2 Agents:** Direct partner APIs (Amazon, Etsy) or browser agents (Steel.dev/Browserbase) for fulfillment.
- **Azure Key Vault:** `cu2-apps-kv` for all secrets; no hardcoded values allowed.
- **Firebase Cloud Messaging:** Push notifications for PWA users.

## Development Status
MVP Core (S-0 through S-9) is complete and deployed. Current focus is on Intelligence slices (S-10–S-12) including browser agent fallback and dossier enrichment. Growth features (S-13–S-16) like gamification and white-labeling are planned but not yet implemented.

## Gotchas
- **Commerce Logic:** Broflo never holds inventory or takes margin; it charges the user's Stripe vault then pays the retailer.
- **Cancel Window:** Every auto-placed order has a hard 2-hour cancel window; this is non-negotiable in the default flow.
- **Agent Safety:** Browser agents must stop immediately if CAPTCHA is detected; do not attempt to bypass security measures.
- **Secrets:** All secrets reside in `cu2-apps-kv`; PR policy forbids direct commits to `main` and requires passing CI.