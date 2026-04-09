# S-0: Walking Skeleton

**Phase:** Foundation
**Estimate:** 1 week
**Depends on:** Nothing — this is the starting point
**Unlocks:** All subsequent slices

---

## Goal

Stand up the full deployment pipeline, cloud infrastructure, and project scaffold so every future slice ships to a real environment from day one. No user-facing features. One deliverable: a "hello world" page deployed to Azure and accessible via a URL.

---

## Definition of Done

- [ ] GitHub repo `broflo` created under `credit-union-2-0-llc` org
- [ ] CLAUDE.md present and aligned with `cu2-standards`
- [ ] Next.js 14 (App Router) scaffolded with Tailwind + shadcn/ui initialized
- [ ] `apps/web` (Next.js) and `apps/api` (NestJS/TypeScript) monorepo structure committed
- [ ] FastAPI AI service stub in `services/ai`
- [ ] PostgreSQL instance provisioned on Azure Database for PostgreSQL
- [ ] Prisma schema initialized with `User` model only
- [ ] Azure App Service environments: `broflo-dev`, `broflo-prod`
- [ ] All secrets in `cu2-apps-kv` Azure Key Vault — zero hardcoded values
- [ ] GitHub Actions CI pipeline: lint → test → build → deploy on merge to `main`
- [ ] Branch protection on `main` per cu2-standards PR policy
- [ ] Staging URL returns HTTP 200 with "broflo." text
- [ ] `.env.example` committed with all required variable names, no values

---

## Tech Tasks

### Repo + Standards
```
- Create repo with cu2-standards CLAUDE.md, qa-standards.md, risk-framework.md
- Set up monorepo structure:
  /apps/web         (Next.js 14)
  /apps/api         (NestJS TypeScript)
  /services/ai      (FastAPI Python)
  /packages/shared  (shared types/utils)
  /docs             (this folder)
- Configure Turborepo or pnpm workspaces
- Add .gitignore, .nvmrc (Node 20 LTS)
```

### Frontend Scaffold (apps/web)
```
- npx create-next-app@latest with App Router, TypeScript, Tailwind
- npx shadcn-ui@latest init
- Add initial shadcn components: Button, Card, Input, Label, Toaster
- Set up dark mode (class-based) in tailwind.config
- Add next-pwa for future PWA support (configured but not activated yet)
- Stub layout: /app/layout.tsx with Toaster provider
- Stub page: /app/page.tsx returning "broflo." heading
- Configure next.config.js for Azure App Service deployment
```

### Backend Scaffold (apps/api)
```
- NestJS CLI scaffold with TypeScript strict mode
- Prisma init with PostgreSQL connection string from Key Vault
- Schema: User model only (id, email, name, created_at)
- Health check endpoint: GET /health → { status: 'ok' }
- Global error handler middleware
- Request logging middleware
```

### AI Service Stub (services/ai)
```
- FastAPI app with single health endpoint: GET /health
- Anthropic SDK installed, API key from environment
- Docker containerized, deployable to Azure Container Apps
```

### Infrastructure
```
- Azure Resource Group: rg-broflo
- Azure Database for PostgreSQL Flexible Server
- Azure App Service Plan (B2 minimum for dev, P1v3 for prod)
- Azure Key Vault: cu2-apps-kv (existing) — add broflo secrets
- Required secrets:
    BROFLO_DATABASE_URL
    BROFLO_JWT_SECRET
    BROFLO_ANTHROPIC_API_KEY
    BROFLO_STRIPE_SECRET_KEY (stub for now)
- Azure Container Registry for AI service image
```

### CI/CD
```
- GitHub Actions workflow: .github/workflows/ci.yml
  - Trigger: push to main, PR to main
  - Jobs: lint, type-check, test, build, deploy-dev
  - deploy-prod: manual trigger only, requires approval
- Secrets loaded from cu2-apps-kv via Azure federated identity (no stored secrets in GitHub)
```

---

## Acceptance Test

```
1. Clone repo on a fresh machine
2. Copy .env.example to .env.local, fill in dev values
3. Run pnpm install && pnpm dev
4. Navigate to localhost:3000 — see "broflo." text
5. Navigate to localhost:3001/health — see { "status": "ok" }
6. Push a commit to main
7. GitHub Actions CI passes all jobs
8. Staging URL returns "broflo." heading
```

---

## Notes

- Do not build any auth, UI components, or features in this slice — scope creep here delays everything downstream
- If the CI pipeline takes more than 5 minutes, optimize before moving on — slow CI compounds across 16 more slices
- Key Vault access pattern must be established correctly here; do not patch it later
