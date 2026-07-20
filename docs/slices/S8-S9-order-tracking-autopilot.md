# S-8: Order Tracking

**Phase:** Automation
**Estimate:** 1 week
**Depends on:** S-7 (orders must exist to track)
**Unlocks:** S-9 (autopilot needs tracking to complete the loop)

---

## Goal

Orders have real-time status. Shipping updates flow in via webhook and are surfaced to the user via email (and later, push notifications in S-14). When a gift is delivered, the event cycle is complete.

---

## Definition of Done

- [x] Order status model: pending → ordered → processing → shipped → delivered → cancelled/failed
- [x] OrderStatusHistory table with timeline tracking (source: system/webhook/manual)
- [x] Timeline endpoint: GET /orders/:id/timeline
- [x] Webhook receiver: POST /orders/webhook/status for external status updates
- [x] Polling cron: checks retailer status every 4 hours for orders without webhooks
- [x] Frontend: orders list with status filters, order detail with StatusTimeline + TrackingCard
- [x] Dashboard widget: OrdersInFlightWidget showing active orders
- [x] Tracking URL stored and shown to user on order detail
- [x] Failed delivery / exception status surfaced with Broflo voice copy

---

## Tech Tasks

### Tracking Integration
```
Use EasyPost or Shippo as unified carrier API:
- Register webhooks for all supported carriers
- Map carrier status codes to Broflo status enum
- Store: carrier, tracking_number, tracking_url, last_status, last_updated

POST /webhooks/tracking     — carrier status update handler
Background job: poll tracking for orders without webhook support (every 4 hours)
```

### Email Templates (Broflo voice)
```
Shipped:
  "It's on its way. {name}'s {item} left the building.
  Track it here: {tracking_url}"

Out for delivery:
  "Today's the day. {item} is out for delivery.
  Try to look surprised when she thanks you."

Delivered:
  "Mission accomplished. {item} was delivered.
  You're welcome. Don't forget to log the reaction."

Exception / delay:
  "Small hiccup. {item} is delayed.
  We're watching it. You can too: {tracking_url}"
```

### Frontend
```
Components:
- TrackingStatusBar — progress steps (Ordered → Shipped → Out for delivery → Delivered)
  using shadcn Progress or custom step indicator
- TrackingLink — external link to carrier tracking page
- DeliveryConfirmation — prompt to add reaction score after delivery
```

---

## Acceptance Test

```
1. Place order (S-7 flow)
2. Simulate "shipped" webhook → email received with tracking link
3. Gift detail page shows "Shipped" status with tracking number
4. Simulate "delivered" webhook → email received with delivery confirmation copy
5. Gift status auto-updates to 'delivered'
6. Prompt to add reaction score appears on gift detail
7. Simulate delivery exception → delay email received with correct Broflo copy
```

---

## Notes

- EasyPost/Shippo free tier is sufficient for MVP volumes
- Some retailers (1-800-Flowers) have their own tracking — use their native status updates where available, fall back to carrier webhooks
- Reaction score prompt (from S-5) should be surfaced on delivery, not before

---
---

# S-9: Autopilot

**Phase:** Automation
**Estimate:** 1 week
**Depends on:** S-7 (orders), S-8 (tracking), S-6 (subscription gate)
**Unlocks:** S-10 (browser agent — a future real purchase-execution path would build on autopilot's rule/run scaffolding)

---

## Goal

Pro+ users can turn autopilot on per person. When a lead-time trigger fires for someone on autopilot, Broflo generates suggestions, auto-selects its top (already-vetted) pick on the user's behalf, and notifies them with a one-tap link to complete the purchase themselves.

**Autopilot does not place orders.** It was originally speced (see "What was speced but not built" below) to auto-*purchase* gifts via a browser-agent microservice, with a notification + cancel window before execution fired. That microservice (S-10) was never built or deployed, so there is no real purchase-execution path for autopilot to call. Rather than ship a toggle that silently no-ops or fails in production, autopilot was scoped down to do everything up to the purchase: it picks and vets the gift, and hands the user a link to buy it. There is no pending/staged order state, so there is nothing to show a countdown for and nothing to swap or cancel — the "decision" already happened (auto-select); the only remaining human action is clicking the buy link or not.

---

## Definition of Done

- [x] AutopilotRule model: per-person rules with occasion types, budget range, monthly cap, lead days, consent tracking
- [x] AutopilotRun model: tracks each run with status (`ready_for_review`, `order_placed`, `failed`, `skipped_budget`, `skipped_confidence`, `skipped_no_suggestion`, `skipped_tier`) — note `order_placed` is reserved for a future real purchase path and is not currently reachable
- [x] AutopilotController: CRUD rules (`POST/GET/PATCH/DELETE /autopilot/rules`), runs list, spend endpoint — all Pro+ tier-gated
- [x] AutopilotService: consent model, $2k platform hard cap, budget validation, monthly spending cap check
- [x] AutopilotScheduler: daily 7AM UTC cron, confidence threshold >= 0.80 auto-selects the top suggestion, < 0.80 notifies for manual approval instead
- [x] NotificationsModule (global): list, unread-count, mark-read, mark-all-read
- [x] Frontend `/autopilot` page: per-person directory with on/off toggle, create/edit/delete rule, expandable recent-runs list, monthly spend summary
- [x] NotificationBell in nav: unread badge, dropdown list, 30s polling
- [x] Voice copy: `autopilot.emptyState`, `enabled`, `disabled`, `consentLabel`, `budgetWarning`, `readyForReview`, `needsApproval`, `tierGate`
- [x] Free tier users see tier gate with upgrade prompt
- [ ] Real auto-purchase execution (see "Still a real future option" below) — not built
- [ ] Swap-before-execution / cancel-pending-order endpoints — not built (no pending-order state exists to act on)

---

## Tech Tasks

### Background Job (as built)
```
AutopilotScheduler (@Cron, runs daily at 7AM UTC — not hourly):
1. For each active AutopilotRule where the user's tier has autopilot entitled:
   find events for that rule's person within [today, today + leadDays]
2. Skip if an AutopilotRun already exists for this rule+event (idempotent)
3. Check monthly spending cap (rule cap, capped at $2,000 platform-wide)
   → over cap: AutopilotRun status=skipped_budget, notify at 80% threshold
4. Check person has a shipping address on file
   → missing: AutopilotRun status=failed, notify "needs your help"
5. Call suggestionsService.generate() (AI call) for the person/event
   → failure: AutopilotRun status=failed
   → no suggestions: AutopilotRun status=skipped_no_suggestion
6. Check suggestion.confidenceScore against threshold (>= 0.80):
   - Below threshold: AutopilotRun status=skipped_confidence, notify
     "needs approval" (linking to the event so the user can pick manually)
   - At/above threshold, and price <= rule budget: continue to step 7
   - Price over budget: AutopilotRun status=skipped_budget
7. Auto-select the suggestion via suggestionsService.selectSuggestion()
   (same call a user's manual pick would make — creates/updates the
   GiftRecord, same as if the user had chosen it themselves)
8. AutopilotRun status=ready_for_review; notify "Autopilot found and
   vetted a gift — tap to review and buy" linking to the event/gift detail
   page, where the retailer buy link lives
```
No execution job, no `execute_at`, no countdown, and no order is ever placed by this job — see Goal section for why.

### API (as built)
```
POST   /autopilot/rules       — create a rule for a person (requires consent)
GET    /autopilot/rules       — list the user's rules (with recent runs)
GET    /autopilot/rules/:id   — get one rule (with run history)
PATCH  /autopilot/rules/:id   — update a rule, including isActive (on/off toggle)
DELETE /autopilot/rules/:id   — delete a rule
GET    /autopilot/runs        — paginated run history, filterable by ruleId
GET    /autopilot/spend       — current month's autopilot spend total
```
All routes are `@RequiresTier('pro', 'elite')`. There is no `PATCH /persons/:id/autopilot`, no `/autopilot/pending`, no `/autopilot/:id/cancel`, and no `/autopilot/:id/swap` — none of those exist because there's no pending-order state for them to act on.

### Frontend (as built)
```
/autopilot page:
- Per-person directory (every person the user has, sorted by name), not a
  dashboard widget — each row has:
  - An on/off toggle switch. Turning a person on with no existing rule
    opens CreateRuleDialog (occasions, budget range, monthly cap, lead
    days, consent checkbox); turning on a person with an existing
    (paused) rule just reactivates it — consent was already captured.
  - A badge (Active/Paused), a delete button (with confirm dialog), and
    an expand chevron
  - Expanded: recent AutopilotRuns with a status badge (Ready to Buy,
    Ordered, Failed, Over Budget, Needs Review, Tier Issue, No Match)
- Monthly spend summary card at the top when any rules exist
- Tier gate screen (Zap icon + upgrade CTA) for free-tier users

There is no AutopilotPendingCard, no countdown timer, and no Swap/Cancel
UI — none of those apply because autopilot never creates a pending order.
```

### Broflo Voice for Autopilot (as built, `packages/shared/src/copy/voice.ts`)
```
Enabled: "Autopilot is live. We'll ping you the moment a gift's ready to buy."
Disabled: "Autopilot paused. We'll wait until you're ready."
Consent checkbox: "I authorize Broflo to automatically shop for and vet
  gifts up to {cap}/month in value on my behalf. I'll always get a
  notification to complete the purchase myself."
Ready for review: "Autopilot found and vetted a gift for {name}. Tap to
  review and buy."
Needs approval: "We found a gift for {name} but weren't confident enough.
  Your call."
Tier gate: "Autopilot is a Pro feature. Upgrade and let us do the work."
```
Note the consent copy itself is explicit that the user completes the purchase — this isn't just an implementation detail, it's disclosed up front at opt-in.

---

## Acceptance Test

```
1. Enable autopilot for Sarah (Pro user) via the /autopilot page toggle
   → CreateRuleDialog opens, consent + budget required, rule created
2. Manually trigger the AutopilotScheduler for Sarah's upcoming event
3. Confidence >= 0.80 → suggestion auto-selected, GiftRecord created,
   AutopilotRun status=ready_for_review, notification arrives with a
   link to the event/gift detail page
4. Click through → gift detail page shows the vetted pick with its
   retailer buy link; nothing fires automatically, no countdown exists
5. Confidence < 0.80 → AutopilotRun status=skipped_confidence,
   "needs approval" notification instead, no auto-select
6. Toggle Sarah's rule off → reactivating later reuses the same rule
   (no re-consent required, since consent was already captured)
7. Free user: /autopilot shows tier gate with upgrade prompt, no access
   to rules
8. Missing shipping address on file → AutopilotRun status=failed,
   "needs your help" notification
9. Monthly cap reached → AutopilotRun status=skipped_budget, budget
   warning notification at 80% threshold
```

---

## Notes

### What was speced but not built
The original design for this slice included a browser-agent purchasing microservice (S-10) that autopilot would call to actually place orders, plus a 2-hour notification-and-cancel window before that execution fired, a swap-before-execution option, and a "full autopilot" (no-window) opt-in. None of that was built: S-10's browser-agent service was never deployed (its feature flag, `AGENT_JOB_RECONCILIATION_ENABLED`, stays off in `CLAUDE.md`'s scheduler table specifically because there's nothing to reconcile against), so there was never a real execution path for a cancel window to protect against. Building the notification/cancel/swap UI on top of a purchase mechanism that doesn't exist would have been pure surface — it was deliberately not built rather than shipped as a facade.

### Still a real future option
If/when the S-10 browser-agent purchasing service is actually built and deployed, autopilot's rule/run scaffolding (AutopilotRule, AutopilotRun, the scheduler's suggestion-generation and confidence-gating logic) is designed to extend into real auto-purchase: the `order_placed` run status already exists in the enum for this reason, and the CLAUDE.md 2-hour cancel window rule ("never remove from default flow") is written to apply once there's a real order to cancel. This is a deliberate open door, not a dead end — but it depends entirely on S-10 shipping first, which it has not.

### Unchanged from original design intent
- The $2,000/month platform-wide hard cap and per-rule monthly cap are enforced as speced.
- Consent is still required and tracked (`consentedAt`, `consentedFromIp`) before a rule can run.
- If the AI suggestion call fails during a run, the user is still notified rather than left with silent failure.
