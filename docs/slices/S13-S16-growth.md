# S-13: Broflo Score + Gamification

**Phase:** Growth
**Estimate:** 2 weeks
**Depends on:** S-5 (gift history), S-8 (delivery status), S-9 (autopilot)
**Unlocks:** Retention flywheel, S-14 (push used for achievement notifications)

---

## Goal

The Broflo Score turns gift-giving into a game. Users have a rolling score, level progression, streaks, and achievement badges. This is the primary retention mechanic — it creates a reason to come back even when no event is imminent.

---

## Definition of Done

- [ ] Broflo Score calculated correctly from all inputs
- [ ] Score updates in real-time after each gift cycle completes
- [ ] Level system with 5 tiers displayed on dashboard and profile
- [ ] Streak counter: consecutive events handled without missing
- [ ] At least 8 badges implemented and earnable
- [ ] "Bro of the Year" badge awarded on Dec 31 to top scorer
- [ ] Score history chart shows progression over time
- [ ] Recovery mechanic: missed event → "Groveling Package" CTA visible
- [ ] Optional leaderboard: user can opt in to share score with friends
- [ ] Gamification UI visible on dashboard and profile page

---

## Score Engine

### Inputs and Weights
```
On-time delivery rate:       30% weight  (orders delivered before event date)
Average reaction score:      30% weight  (1–5 stars, normalized to 0–1)
Gift variety:                15% weight  (unique categories / total gifts)
Streak multiplier:           15% weight  (consecutive events handled ÷ max streak)
People tracked (active):     10% weight  (capped at 10 people for scoring purposes)

Broflo Score = sum(inputs × weights) × 1000, rounded to integer
Score decay: -5 points per missed event (applied at event date if status = missed)
```

### Levels
```
0–199:    Rookie Bro        ("You exist. Good start.")
200–399:  Solid Dude        ("You've sent at least one gift. Respect.")
400–599:  Gift Whisperer    ("People notice. They just won't say it.")
600–799:  The Legend        ("Serious numbers. Serious thoughtfulness.")
800–1000: Broflo Elite      ("There is no higher calling.")
```

### Badges
```
First Blood:    First gift sent
The Closer:     5-star reaction score received
Clutch Play:    Order placed with <48hr lead time and delivered on time
Long Game:      Same person, 5+ consecutive events actioned
Bro of the Year: Highest score on Dec 31 (annual, resets Jan 1)
The Oracle:     AI suggestion accepted without reviewing alternatives (trust the bot)
Overachiever:   5+ active people with autopilot enabled
Groveling Pro:  Groveling Package ordered (miss an event, recover gracefully)
```

---

## Tech Tasks

### Score Service (apps/api or services/ai)
```
ScoreCalculatorService:
  calculateScore(userId): BrofloScore
  updateScore(userId, triggerEvent): void

Trigger events that recalculate score:
  - Gift delivered
  - Reaction score added
  - Event missed
  - Streak broken
  - New person added

ScoreHistory: { user_id, score, calculated_at, trigger_event }
```

### Achievement Engine
```
AchievementService:
  checkAchievements(userId, triggerEvent): Badge[]
  awardBadge(userId, badgeId): void

Badge: { id, user_id, badge_type, earned_at, event_context }
Run after every score recalculation
```

### Leaderboard (opt-in)
```
- User opts in via settings toggle
- Leaderboard shows: display_name (no email), score, level, badge count
- Anonymous by default if no display_name set: "Mystery Bro #[id_fragment]"
- Leaderboard limited to 100 entries, sorted by score desc
- Weekly reset option (show this week's top movers, not all-time)
```

### Frontend
```
Pages:
- Score widget on /app/dashboard — score ring + level + streak counter
- /app/profile/score — full score breakdown, history chart, all badges

Components:
- BrofloScoreRing — circular progress (SVG) showing 0–1000, level color
- LevelBadge — level name + color + short quote
- StreakCounter — fire icon + "X-event streak"
- BadgeGrid — earned badges highlighted, locked badges grayed out
- ScoreHistoryChart — Recharts line chart of score over time
- AchievementToast — animated toast on badge earned
  "Achievement unlocked: The Closer. You made someone give you 5 stars.
  Feel free to tell literally no one."
- Leaderboard (opt-in) — simple table with shadcn Table
- GrovelingPackageCTA — shown after missed event
  "You missed {name}'s {event}. The Groveling Package is standing by.
  [Get the Groveling Package]"
```

### shadcn/ui Components to Add
```
npx shadcn-ui@latest add table
```

---

## Acceptance Test

```
1. New account: score = 0, level = Rookie Bro
2. Send gift, add 5-star reaction → score increases, "First Blood" badge earned
3. Toast: "Achievement unlocked: First Blood. You sent your first gift.
   Technically everyone does this eventually."
4. Miss an event → score decays by 5, Groveling Package CTA appears
5. Complete Groveling Package order → "Groveling Pro" badge earned
6. Place order with <48hr lead time → "Clutch Play" badge earned
7. Score chart shows progression over last 30 days
8. Opt into leaderboard → profile visible to other opted-in users
9. Dec 31 simulation → "Bro of the Year" awarded to top scorer
```

---
---

# S-14: PWA + Push Notifications

**Phase:** Growth
**Estimate:** 1 week
**Depends on:** S-13 (gamification events are push notification candidates)
**Unlocks:** Mobile-class UX without native app store

---

## Goal

Broflo is installable on iOS and Android home screens. Push notifications replace email as the primary alert channel for lead-time warnings and autopilot pre-fire notifications.

---

## Definition of Done

- [ ] Next.js app meets PWA requirements (manifest, service worker, HTTPS)
- [ ] "Add to home screen" prompt triggers on mobile browsers
- [ ] App icon, splash screen, and name display correctly on iOS and Android
- [ ] Firebase Cloud Messaging (FCM) integrated for push notifications
- [ ] Push replaces email for: lead-time alerts, autopilot pre-fire, order status, badge earned
- [ ] User can manage notification preferences in settings
- [ ] Offline shell: app shows cached dashboard if offline, not browser error
- [ ] iOS push tested on real device (Safari requires special PWA push handling)

---

## Tech Tasks

```
- next-pwa config: activate service worker, generate manifest
- /public/manifest.json: name, icons (192x192, 512x512), theme_color, display: standalone
- FCM SDK in Next.js client: request permission, store token on User
- API: PATCH /users/me/push-token
- Notification triggers: replace/augment email sends with FCM pushes
- Settings page: NotificationPreferences component
  - Toggles per notification type: lead-time, autopilot, order status, badges
  - "Test notification" button
- Offline page: /app/offline/page.tsx with Broflo copy:
  "You're offline. We've got nothing for you right now. 
   But Sarah's birthday is still coming."
```

### iOS PWA Push (special handling)
```
iOS requires:
- HTTPS (already required)
- Web Push API (available in iOS 16.4+ via Safari)
- User must add to home screen first before push permission dialog appears
- Use web-push library with VAPID keys for cross-platform support
```

---

## Acceptance Test

```
1. Open Broflo on iOS Safari → "Add to Home Screen" prompt appears
2. Install to home screen → app opens in standalone mode, no browser chrome
3. Enable push notifications → permission dialog shown
4. Trigger lead-time alert → push notification received on device
5. Tap notification → deep links to correct event in app
6. Turn off WiFi → app shows offline shell, not browser error
7. Reconnect → app resumes with fresh data
8. Disable "order status" notifications in settings → order update sends email only
```

---
---

# S-15: Retailer Expansion

**Phase:** Growth
**Estimate:** 1 week
**Depends on:** S-7 (retailer adapter pattern), S-10 (browser agent)
**Unlocks:** Broader gift coverage, higher suggestion quality

---

## Goal

Add Etsy and Viator (experiences) as native integrations alongside the existing 1-800-Flowers / Amazon layer. This meaningfully expands the personalization range of the Gift Brain.

---

## Definition of Done

- [ ] Etsy Open API v3 integrated: search products by keyword, link to listing
- [ ] Viator API integrated: search experiences by city + category + budget
- [ ] Gift Brain AI updated to suggest Etsy and Viator options when relevant
- [ ] Experience gifts surfaced as a distinct category in suggestions
- [ ] Etsy orders handled via browser agent (Etsy doesn't have a native buy API)
- [ ] Viator booking handled via deep link (user completes booking themselves — complexity too high for agent)
- [ ] Suggestion UI distinguishes experiences from physical gifts

---

## Tech Tasks

```
EtsyAdapter: search(keywords, budget) → Product[] (links to listing)
ViatorAdapter: searchExperiences(city, category, budget) → Experience[]

AI prompt update: add Etsy and experience categories to Gift Brain system prompt
ExperienceSuggestionCard — distinct UI treatment (map pin icon, "Experience" badge)

For Viator: suggest_retailer = 'viator', order_method = 'link'
  → "Order This" button becomes "Book on Viator" deep link
  → No order tracking for experiences
```

---
---

# S-16: White-Label Shell

**Phase:** Growth
**Estimate:** 1 week
**Depends on:** All core slices complete
**Unlocks:** B2B vertical (corporate gifting, financial advisors, real estate agents)

---

## Goal

Broflo's core engine can be skinned and deployed as a white-labeled product for B2B customers. A corporate client (e.g. a financial advisor firm or credit union) gets their own branded instance of Broflo for client gifting.

---

## Definition of Done

- [ ] `Tenant` model added — each white-label client is a tenant
- [ ] Tenant config: name, logo URL, primary color, support email, custom domain
- [ ] White-label users are created under a tenant and see branded UI
- [ ] "Broflo" name, logo, and brand copy swappable via tenant config
- [ ] Tenant admin can manage users, view aggregate stats (no individual gift data)
- [ ] Tenant billing: flat monthly rate, separate Stripe product
- [ ] Broflo-branded public product unaffected (tenant = null = default Broflo brand)
- [ ] Multi-tenant data isolation enforced at query level (Row Level Security via Prisma)

---

## Tech Tasks

```
Database:
- Tenant: id, name, slug, logo_url, primary_color, support_email, created_at
- User: add tenant_id (nullable — null = Broflo consumer product)
- All queries scoped by tenant_id where tenant_id is set

API:
- TenantMiddleware: resolve tenant from subdomain or custom domain
- Tenant admin endpoints: GET /admin/users, GET /admin/stats

Frontend:
- TenantThemeProvider: reads tenant config, applies primary_color + logo to layout
- Replace "broflo" text references with tenant.name in themed instances
- Custom domain support via Next.js rewrites or Vercel/Azure custom domains

Billing:
- Stripe product: "Broflo Enterprise" — negotiated flat rate
- Tenant subscription stored separately from consumer subscriptions
```

### Target B2B Verticals
```
Priority 1: Credit unions (CU 2.0 existing relationships)
  Use case: member gifting, loan officer client gifts, milestone recognition
  Pitch: "Turn every member birthday into a relationship touchpoint"

Priority 2: Financial advisors / RIAs
  Use case: client birthday + holiday gifting, within compliance gift limits

Priority 3: Real estate agents
  Use case: closing gifts, client anniversary follow-up
```

---

## Acceptance Test

```
1. Create tenant: "Rogue Credit Union", slug: rogue-cu, primary: #003366
2. Navigate to rogue-cu.broflo.com (or /tenant/rogue-cu in dev)
3. App renders with Rogue CU logo, blue color scheme — no "Broflo" branding visible
4. Create user under Rogue CU tenant
5. User's gift data isolated — not visible to other tenants
6. Tenant admin sees user list and aggregate stats, not individual gift details
7. Broflo consumer product at broflo.com unaffected — renders normal brand
8. Tenant billing managed separately in Stripe
```

---

## Notes

- The white-label shell is the entry point for a significant B2B revenue line — keep the architecture clean
- CU 2.0 existing credit union relationships are the priority pipeline for the first 3–5 enterprise accounts
- Do not build a full tenant admin portal in this slice — a basic user list and stats view is sufficient for MVP B2B sales
