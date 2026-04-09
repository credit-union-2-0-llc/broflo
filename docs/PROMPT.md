# Broflo — Agent Studio Dev Team Brief
## Master Product Prompt (Revised)

> *"You're busy. We remembered. She's impressed. You're welcome."*

---

## What We're Building

Broflo is an AI-powered gift concierge. It tracks the people in a user's life, curates thoughtful gift suggestions using AI, and executes purchases automatically on the user's behalf — from any retailer on the internet.

**Broflo is NOT a store.** It is a purchasing agent. No storefront, no inventory, no commerce margin. Money comes from subscriptions only. This is a deliberate design and business model decision — it creates a trust moat no gift-box service can touch.

---

## Repository

**GitHub Org:** `credit-union-2-0-llc`
**Repo:** `broflo` (new)
**Standards:** `cu2-standards` repo conventions apply from day one. CLAUDE.md, qa-standards.md, risk-framework.md are required. Key Vault: `cu2-apps-kv`.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | **Next.js 14 (App Router)** + **Tailwind CSS** + **shadcn/ui** |
| Backend | Node.js / TypeScript (NestJS) |
| AI Services | Python / FastAPI + Anthropic API (`claude-sonnet-4`) |
| Database | PostgreSQL (Azure) + Prisma ORM |
| Auth | NextAuth.js (JWT + refresh tokens) |
| Payments | Stripe (subscriptions + payment vault) |
| Commerce | Retailer APIs + browser agent fallback (Steel.dev / Browserbase) |
| Notifications | Firebase Cloud Messaging (FCM) + email (Resend/SendGrid) |
| Cloud | Azure (App Service, Key Vault, Container Registry, PostgreSQL) |
| CI/CD | GitHub Actions |

### Frontend Architecture Principles

- **Next.js 14 App Router** — server components for data pages, client components for interactivity
- **Tailwind CSS** — utility-first, no custom CSS files, no CSS modules
- **shadcn/ui** — Radix UI-based component library; add components via CLI only as needed. Do not pre-install the full library.
- **Form handling** — react-hook-form + zod for all forms
- **Dark mode** — class-based (`dark:`), respects system preference
- **PWA** — `next-pwa` configured from S-0, activated in S-14

---

## Brand Voice

Mildly cocky. Self-aware. Tongue-in-cheek. Think "confident guy who actually has his life together and is secretly thoughtful." Never frat-bro. Never saccharine. Never try-hard. The best Broflo copy makes you smile once and then gets out of the way.

**Default pronoun:** they/them unless user specifies relationship context. Broflo is gender-inclusive.

**Examples:**
- Empty state: *"Nothing here yet. That's fine. Nobody's judging. (We're judging a little.)"*
- Successful order: *"Done. She has no idea how easy that was. Keep it that way."*
- 30-day alert: *"Heads up: Sarah's birthday is in 30 days. Plenty of time. For now."*
- Missed event: *"We tried to warn you. The Groveling Package awaits."*
- Level up: *"Welcome to Gift Whisperer. People notice. They just won't say it."*

All copy is centralized in `/packages/shared/copy/voice.ts`. No inline strings for UI copy.

---

## Core Product Loop

```
Add person + dossier
    ↓
Event detected (birthday, anniversary, etc.)
    ↓
Lead-time alert fires (email or push)
    ↓
AI curates 3–5 personalized suggestions
    ↓
User approves (or autopilot executes automatically)
    ↓
Order placed via retailer API or browser agent
    ↓
Tracking → Delivery confirmation
    ↓
User logs reaction score → Broflo Score updates
    ↓
History feeds future suggestions (anti-repeat, preference refinement)
```

---

## Commerce Architecture

Broflo places orders on behalf of users. It does not sell products.

**How purchasing works:**

1. User stores a payment method via Stripe (during subscription setup)
2. When an order is approved, Broflo charges the user's card via Stripe
3. Broflo fulfills the order via:
   - **Tier 1 — Retailer API:** Direct partner integration (1-800-Flowers, Amazon, Etsy, Viator)
   - **Tier 2 — Browser agent:** Steel.dev or Browserbase executes purchase on any retail site
4. Order confirmation, tracking number, and audit log stored on Gift record
5. 2-hour cancel window on every order — hard requirement, never remove from default flow

**Broflo never:**
- Holds inventory
- Takes a margin on purchases
- Bypasses CAPTCHA (agent stops immediately if detected)
- Sends raw card numbers to third parties

---

## Monetization

Subscription only. No commerce margin at launch.

| Tier | Price | Key Limits |
|---|---|---|
| Free | $0 | 3 people, suggestions only, no auto-execute |
| Pro | $9.99/mo | Unlimited people, autopilot, full gamification |
| Elite | $24.99/mo | Everything + concierge escalation, handwritten notes, early access |

Annual pricing: 2 months free ($99/yr Pro, $249/yr Elite).

**Unit economics:** ~85–90% gross margin. Primary variable cost is Anthropic API inference (~$0.50–$1.50/active user/month) plus browser agent compute (~$0.10–$0.30/order).

**Future revenue (build later, don't promise now):**
- B2B white-label for corporate gifting (S-16 lays the foundation)
- API access tier for developers embedding Broflo logic
- Broflo Concierge: one-time add-on for weddings/major milestones

---

## Gamification — The Broflo Score

The primary retention mechanic. Makes being thoughtful addictive.

```
Score (0–1000) = weighted sum:
  On-time delivery rate:    30%
  Average reaction score:   30%
  Gift variety:             15%
  Streak multiplier:        15%
  People tracked (active):  10%

Decay: -5 points per missed event

Levels: Rookie Bro → Solid Dude → Gift Whisperer → The Legend → Broflo Elite

Badges: First Blood, The Closer, Clutch Play, Long Game,
        Bro of the Year, The Oracle, Overachiever, Groveling Pro

Recovery: Missed event → "Groveling Package" CTA → curated apology gift set
```

---

## SDLC: Vertical Slice Approach

We build in vertical slices. Each slice is a full-stack, end-to-end deliverable that a real user can touch. No horizontal layers. No "just the API" or "just the UI" slices.

**Slice Rules:**
1. Every slice ships to a real environment (not localhost)
2. Every slice has a written Definition of Done before development starts
3. Every slice has an acceptance test runnable by a non-developer
4. No slice begins until the prior slice's acceptance test passes
5. Slice docs live in `/docs/slices/` — updated as implementation reveals new information

### Slice Roadmap

| Slice | Name | Phase | Weeks | Key Deliverable |
|---|---|---|---|---|
| S-0 | Walking skeleton | Foundation | 1 | CI/CD + Azure + deploy pipeline live |
| S-1 | Identity + auth | MVP Core | 1 | Real user can sign up and log in |
| S-2 | Person dossier | MVP Core | 1.5 | Create/edit person with full preferences |
| S-3 | Event radar | MVP Core | 1 | Upcoming events dashboard + email alerts |
| S-4 | Gift brain MVP | MVP Core | 1.5 | AI returns 3–5 ranked gift suggestions |
| S-5 | Gift history loop | MVP Core | 0.5 | Full MVP demo loop complete ← **Demo checkpoint** |
| S-6 | Stripe + vault | Automation | 1 | Subscription billing + card on file |
| S-7 | First retailer API | Automation | 1.5 | Real order placed via retailer API ← **High risk** |
| S-8 | Order tracking | Automation | 1 | Shipping status → email updates |
| S-9 | Autopilot toggle | Automation | 1 | Full autopilot with 2-hour cancel window |
| S-10 | Browser agent | Intelligence | 1.5 | Orders from any site without a partner API |
| S-11 | Dossier enrichment | Intelligence | 1.5 | Pinterest/wishlist URL → auto-populate dossier |
| S-12 | Voice layer | Intelligence | 0.5 | All UI copy using Broflo brand voice |
| S-13 | Broflo score | Growth | 2 | Score engine, levels, badges, gamification UI |
| S-14 | PWA + push | Growth | 1 | Home screen install + push notifications |
| S-15 | Retailer expansion | Growth | 1 | Etsy + Viator integrations |
| S-16 | White-label shell | Growth | 1 | Multi-tenant B2B ready |

**Total:** ~18.5 weeks solo · ~13 weeks with two devs (parallel non-dependent slices)

**MVP demo checkpoint:** After S-5, the following loop is demonstrable:
> Create account → Add Sarah → Add birthday → See event on radar →
> Get AI suggestions → Accept suggestion → View gift history → Add reaction score

Do not start the Automation phase until this demo runs clean.

---

## Key Design Decisions (Resolved)

| Decision | Choice | Rationale |
|---|---|---|
| Frontend framework | Next.js 14 App Router | SSR for SEO/performance, RSC for data pages |
| UI components | shadcn/ui | Best-in-class Radix primitives, Tailwind-native, no license issues |
| Commerce layer | Agent purchaser (no storefront) | Cleaner model, better trust story, higher margin |
| Monetization | Subscription only | No commerce conflicts of interest |
| Auth | NextAuth.js | Most complete Next.js auth solution |
| Mobile | PWA first | 90% of use case, avoids app store complexity |
| B2B | Multi-tenant white-label | Opens CU + advisor verticals without a separate product |

---

## Open Questions (Resolve Before or During S-1)

1. **Payment flow architecture:** Charge user's card then Broflo pays retailer (simpler) vs. Stripe Connect with retailer as merchant (cleaner, more complex). Decision needed before S-7.
2. **Social enrichment legality:** Pinterest API vs. public URL parsing vs. user-uploaded screenshots. Review ToS before S-11 spec is finalized.
3. **"The Groveling Package":** Define the 3–5 default curated SKUs before S-4. This is a product design question that needs an answer before the AI can suggest it.
4. **Browser agent service:** Steel.dev vs. Browserbase — evaluate latency, reliability, and cost before S-10 starts.
5. **Leaderboard:** Friend graph vs. anonymous percentile ranking. Simpler to launch with anonymous percentile; friend graph adds social surface area.

---

## Docs Structure

```
/docs
  README.md               ← this file (master brief + project overview)
  /slices
    S0-walking-skeleton.md
    S1-identity-auth.md
    S2-person-dossier.md
    S3-event-radar.md
    S4-gift-brain-mvp.md
    S5-gift-history-loop.md
    S6-stripe-payment-vault.md
    S7-first-retailer-api.md
    S8-S9-order-tracking-autopilot.md
    S10-S11-S12-intelligence.md
    S13-S16-growth.md
```

Each slice doc contains: Goal, Definition of Done, Tech Tasks, Acceptance Test, Notes.

---

## Standards Reminders

- All secrets in `cu2-apps-kv` Azure Key Vault — zero hardcoded values, zero committed secrets
- PR policy: no direct commits to `main` — all changes via PR with passing CI
- Environment parity: dev and prod use identical infrastructure (different resource sizes, same config pattern)
- Versioning and release notes per `cu2-standards` versioning-release-notes.md
- Risk register maintained in risk-framework.md — update before each phase boundary

---

Good luck. Don't miss her birthday.
— *Broflo*
