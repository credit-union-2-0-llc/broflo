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

- [ ] Carrier webhooks registered for UPS, FedEx, USPS
- [ ] Order status updates: `ordered` → `shipped` → `out_for_delivery` → `delivered`
- [ ] Email notification sent at each status change
- [ ] Delivery confirmation email uses Broflo voice
- [ ] Gift status auto-updates to `delivered` on delivery confirmation
- [ ] Tracking URL stored and shown to user on gift detail
- [ ] Failed delivery / exception status surfaced with Broflo copy
- [ ] Carrier tracking number extracted from retailer order confirmation

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

# S-9: Autopilot Toggle

**Phase:** Automation
**Estimate:** 1 week
**Depends on:** S-7 (orders), S-8 (tracking), S-6 (subscription gate)
**Unlocks:** S-10 (browser agent — autopilot is needed for agent-placed orders)

---

## Goal

Pro users can enable full autopilot per person. Broflo selects and places the top-ranked gift automatically when the lead-time trigger fires, with a 2-hour notification + cancel window before execution.

---

## Definition of Done

- [ ] Autopilot toggle available per person on dossier (Pro tier only)
- [ ] When autopilot on: lead-time trigger → AI runs suggestions → top suggestion selected → user notified with 2-hour window
- [ ] During 2-hour window: user can reject/swap suggestion before order fires
- [ ] After 2-hour window: order placed automatically
- [ ] Full autopilot mode (fire without window): separate toggle, requires explicit opt-in
- [ ] Autopilot runs within user's configured budget range — never exceeds max
- [ ] Autopilot orders use the same audit log as manual orders
- [ ] Autopilot can be disabled globally or per-person
- [ ] Free tier users see autopilot toggle grayed out with upgrade prompt

---

## Tech Tasks

### Background Job
```
AutopilotJob (runs hourly):
1. Find events with status=pending where lead_time_trigger fires today
2. For each: check person.autopilot_enabled
3. If enabled: POST /suggestions/generate (AI call)
4. Store top suggestion as pending_autopilot_order
5. Send notification (email): "Broflo is about to order {item} for {name}. 
   You have 2 hours to change your mind."
6. Set execute_at = now() + 2 hours
7. ExecutionJob (runs every 15min): find pending_autopilot_orders where execute_at <= now()
   and not cancelled → POST /orders/place
```

### API
```
PATCH /persons/:id/autopilot      — toggle autopilot for person
GET   /autopilot/pending          — list pending autopilot orders awaiting window
POST  /autopilot/:id/cancel       — cancel pending autopilot order
POST  /autopilot/:id/swap         — replace the selected suggestion before execution
PATCH /users/me/autopilot         — global autopilot settings
```

### Frontend
```
Components:
- AutopilotToggle — shadcn Switch on person dossier
  "Let Broflo handle it" with UpgradeBadge if free tier
- AutopilotPendingCard — dashboard widget showing upcoming auto-orders
  with countdown timer and Swap/Cancel options
- AutopilotSettingsPanel — global settings on profile page
  - Default autopilot: on/off
  - Notification window: 2hr / 4hr / 24hr
  - "Full autopilot" opt-in (no window, fires immediately)
```

### Broflo Voice for Autopilot
```
Autopilot enabled: "Autopilot engaged. We'll handle {name}. You're welcome."
Pre-fire notification: "About to order {item} for {name}'s {event} in {n} days. 
  Two hours to change your mind. [Review] [Cancel]"
Order fired: "Autopilot executed. {item} is on its way to {name}. 
  You didn't lift a finger. As intended."
Cancelled by user: "Understood. We've stood down. You've got the wheel."
```

---

## Acceptance Test

```
1. Enable autopilot for Sarah (Pro user)
2. Manually trigger AutopilotJob for Sarah's upcoming event
3. Notification email arrives: pending order for {item} with review link
4. Click review link → AutopilotPendingCard shows item + countdown
5. Let countdown expire → ExecutionJob fires → order placed
6. Order appears in gift history with source='autopilot'
7. Run again → click Cancel during window → order does not fire
8. Free user: autopilot toggle grayed out, upgrade prompt shown
9. "Full autopilot" opt-in → order fires immediately, no window
```

---

## Notes

- The 2-hour cancel window is non-negotiable UX — it's the trust mechanism. Never remove it from the default flow.
- "Full autopilot" (no window) must be a deliberate second opt-in — never the default
- If AI suggestion fails during autopilot run, send human-escalation email: "We couldn't find the right gift automatically. [Review suggestions manually]"
