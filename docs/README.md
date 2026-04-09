# Broflo — AI-Powered Gift OS

> *"You're busy. We remembered. She's impressed. You're welcome."*

## Overview

Broflo is a subscription SaaS gift concierge. It tracks the people in a user's life, curates AI-personalized gift ideas, and executes purchases automatically on the user's behalf — across any retailer on the internet.

Broflo is **not** a storefront or retailer. It is a purchasing agent. It makes money exactly once per customer: the subscription. No margins on goods. No affiliate play at launch. Pure subscription SaaS with 85–90% gross margin targets.

---

## Repository

**GitHub Org:** `credit-union-2-0-llc`
**Repo:** `broflo`
**Standards:** All secrets, PRs, QA, versioning, and risk frameworks follow `cu2-standards` repo conventions. CLAUDE.md applies from day one.

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui | PWA-capable via next-pwa |
| Backend API | Node.js / TypeScript (NestJS or Express) | Hosted on Azure App Service |
| AI Services | Python / FastAPI | Anthropic API (claude-sonnet-4) |
| Database | PostgreSQL (Azure Database) | Prisma ORM |
| Auth | NextAuth.js / Auth.js | JWT + refresh tokens |
| Payments | Stripe | Subscriptions + payment vault for agent purchases |
| Cloud | Azure | Key Vault: `cu2-apps-kv` |
| Commerce | Retailer APIs + browser agent fallback | See Integrations section |
| Notifications | Firebase Cloud Messaging (FCM) | iOS + Android push via PWA |
| CI/CD | GitHub Actions | Per cu2-standards |

### Frontend Detail

- **Next.js 14 App Router** — server components for data-heavy pages, client components for interactive UI
- **Tailwind CSS** — utility-first, no custom CSS files
- **shadcn/ui** — component library built on Radix UI primitives; use the CLI to add components only as needed (`npx shadcn-ui@latest add button card dialog`)
- **No custom component library** — shadcn/ui covers all UI needs; extend via Tailwind variants only
- **Dark mode** — class-based (`dark:`), system default
- **PWA** — `next-pwa` with service worker, manifest, home screen install support

---

## Product Summary

### The Problem

Men (and plenty of women) are chronically terrible at gift-giving — not because they don't care, but because the cognitive overhead is brutal. Remembering dates, knowing preferences, finding ideas, ordering on time, and not repeating yourself is a four-variable optimization problem most humans fail continuously.

### The Solution

Broflo solves the entire cycle:
1. **Know** — Per-person dossiers with preferences, sizes, history, wish lists
2. **Remember** — Event radar with intelligent lead-time alerts
3. **Curate** — AI gift suggestions ranked by fit, novelty, and budget
4. **Execute** — Automated purchasing via retailer APIs and browser agent fallback
5. **Delight** — Gamified Broflo Score that makes being thoughtful addictive

---

## Brand Voice

Mildly cocky. Self-aware. Tongue-in-cheek. Think "confident guy who actually has his life together and is secretly thoughtful." Never frat-bro. Never saccharine.

**Examples:**
- Empty gift history: *"Nothing here yet. That's fine. Nobody's judging. (We're judging a little.)"*
- Successful order: *"Done. She has no idea how easy that was. Keep it that way."*
- 30-day alert: *"Heads up: Sarah's birthday is in 30 days. Plenty of time. For now."*
- Missed event: *"We tried to warn you. The Groveling Package awaits."*

**Gender language:** Default they/them in copy unless the user specifies. Broflo is for anyone bad at gift-giving.

---

## Core Data Model

### User
```
id, email, name, subscription_tier, stripe_customer_id,
stripe_payment_method_id, broflo_score, created_at
```

### Person (Dossier)
```
id, user_id, name, relationship_type, birthday, anniversary,
budget_min, budget_max, clothing_sizes (jsonb), music_taste (text[]),
favorite_brands (text[]), hobbies (text[]), food_preferences (text[]),
notes, social_urls (jsonb), never_again_list (text[]),
wishlist_urls (text[]), created_at, updated_at
```

### Event
```
id, person_id, user_id, event_type, event_date,
lead_time_days, severity (1-3), status (pending|actioned|missed),
created_at
```

### Gift
```
id, person_id, event_id, user_id, title, description,
retailer, order_url, price, currency, order_id,
tracking_number, carrier, status (suggested|approved|ordered|delivered),
reaction_score (1-5), ordered_at, delivered_at, created_at
```

### GiftSuggestion
```
id, event_id, person_id, title, description, rationale,
retailer_name, retailer_url, estimated_price, delight_score,
novelty_score, rank, ai_model_version, created_at
```

---

## Monetization

Broflo earns on subscription only. No commerce margin. No affiliate at launch.

| Tier | Price | Limits |
|---|---|---|
| Free | $0/mo | 3 people, suggestions only, no auto-execute |
| Pro | $9.99/mo | Unlimited people, AI curation, autopilot, gamification |
| Elite | $24.99/mo | Everything + concierge escalation, handwritten notes, early access |

Annual: 2 months free ($99/yr Pro, $249/yr Elite).

---

## Commerce Architecture

Broflo is a purchasing agent, not a retailer.

**Tier 1 — Direct Retailer APIs:**
- Amazon Product Advertising API + Buy API
- 1-800-Flowers / Teleflora API
- Harry & David / Goldbelly
- Etsy Open API v3
- Viator (experiences)

**Tier 2 — Browser Agent Fallback:**
- Steel.dev or Browserbase managed browser agent
- Executes purchases on any retail site
- User's stored Stripe payment method used
- Every auto-placed order has a 2-hour cancel window
- Full audit log in dossier

**What Broflo does NOT have:**
- A product catalog or storefront
- Inventory of any kind
- Wholesale or merchant accounts
- Commerce margin on any purchase

---

## Gamification — The Broflo Score

| Element | Detail |
|---|---|
| Score range | 0–1000 rolling |
| Inputs | On-time rate, reaction scores, gift variety, streaks, people tracked |
| Streaks | Consecutive events handled without a miss |
| Levels | Rookie Bro → Solid Dude → Gift Whisperer → The Legend → Broflo Elite |
| Badges | First Blood, The Closer, Clutch Play, Long Game, Bro of the Year |
| Recovery | Missed event → "The Groveling Package" auto-curated |
| Leaderboard | Optional friend graph, full opt-in |

---

## Slice Roadmap Summary

| Slice | Name | Phase | Est. Weeks |
|---|---|---|---|
| S-0 | Walking skeleton | Foundation | 1 |
| S-1 | Identity + auth | MVP Core | 1 |
| S-2 | Person dossier | MVP Core | 1.5 |
| S-3 | Event radar | MVP Core | 1 |
| S-4 | Gift brain MVP | MVP Core | 1.5 |
| S-5 | Gift history loop | MVP Core | 0.5 |
| S-6 | Stripe + payment vault | Automation | 1 |
| S-7 | First retailer API | Automation | 1.5 |
| S-8 | Order tracking | Automation | 1 |
| S-9 | Autopilot toggle | Automation | 1 |
| S-10 | Browser agent fallback | Intelligence | 1.5 |
| S-11 | Dossier enrichment | Intelligence | 1.5 |
| S-12 | Voice layer | Intelligence | 0.5 |
| S-13 | Broflo score + gamification | Growth | 2 |
| S-14 | PWA + push notifications | Growth | 1 |
| S-15 | Retailer expansion | Growth | 1 |
| S-16 | White-label shell | Growth | 1 |

**Total:** ~18.5 weeks solo · ~13 weeks with two devs running parallel slices

---

## Open Questions (Resolve in Discovery)

1. PWA-first vs. React Native — PWA covers 90% of the push notification use case; revisit React Native only if iOS notification fidelity becomes a hard blocker
2. Shopify as a single vendor vs. multi-retailer API — multi-retailer is the correct architecture, do not add a Shopify merchant account
3. Social scraping legality — Pinterest and Instagram ToS restrict automated scraping; user-submitted wishlist URLs + AI parsing is the safe path at launch
4. What does "The Groveling Package" look like as an actual curated set? Define the 3–5 default SKUs before S-4 ships.
5. Leaderboard — friend graph vs. anonymous percentile ranking to avoid privacy friction at launch

---

## Docs Index

- [S-0: Walking Skeleton](./slices/S0-walking-skeleton.md)
- [S-1: Identity + Auth](./slices/S1-identity-auth.md)
- [S-2: Person Dossier](./slices/S2-person-dossier.md)
- [S-3: Event Radar](./slices/S3-event-radar.md)
- [S-4: Gift Brain MVP](./slices/S4-gift-brain-mvp.md)
- [S-5: Gift History Loop](./slices/S5-gift-history-loop.md)
- [S-6: Stripe + Payment Vault](./slices/S6-stripe-payment-vault.md)
- [S-7: First Retailer API](./slices/S7-first-retailer-api.md)
- [S-8: Order Tracking](./slices/S8-order-tracking.md)
- [S-9: Autopilot Toggle](./slices/S9-autopilot-toggle.md)
- [S-10: Browser Agent Fallback](./slices/S10-browser-agent.md)
- [S-11: Dossier Enrichment](./slices/S11-dossier-enrichment.md)
- [S-12: Voice Layer](./slices/S12-voice-layer.md)
- [S-13: Broflo Score + Gamification](./slices/S13-broflo-score.md)
- [S-14: PWA + Push Notifications](./slices/S14-pwa-push.md)
- [S-15: Retailer Expansion](./slices/S15-retailer-expansion.md)
- [S-16: White-Label Shell](./slices/S16-white-label.md)
