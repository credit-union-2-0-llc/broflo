# S-6: Stripe + Payment Vault

**Phase:** Automation
**Estimate:** 1 week
**Depends on:** S-5 (full MVP loop complete)
**Unlocks:** S-7 (auto-execute needs a payment method), S-9 (autopilot needs subscription gate)

---

## Goal

Subscription billing is live. Users can upgrade from Free to Pro or Elite. Payment method is stored securely in Stripe and available for agent-placed orders in S-7+. Feature gates enforce tier limits.

---

## Definition of Done

- [ ] Stripe Checkout session initiates from upgrade prompt
- [ ] Webhook handler processes: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- [ ] Subscription tier stored on User record, gates enforced immediately
- [ ] Free tier: 3 people max — 4th person creation returns 402 with upgrade prompt
- [ ] Pro tier: unlimited people, autopilot enabled, full gamification
- [ ] Elite tier: everything + concierge flag on User
- [ ] Payment method (card) stored in Stripe — `stripe_payment_method_id` on User
- [ ] Billing portal link: user can manage/cancel subscription via Stripe portal
- [ ] Payment failure: subscription downgraded to Free, user notified with Broflo voice
- [ ] Stripe webhook signature verified on every event — no unauthenticated processing
- [ ] No card numbers ever touch Broflo servers — Stripe Elements only

---

## Tech Tasks

### API
```
POST /billing/checkout-session     — create Stripe Checkout session
POST /billing/portal-session       — create Stripe Customer Portal session
POST /billing/webhook              — Stripe webhook handler (no auth, signature verified)
GET  /billing/subscription         — current subscription status
```

### Stripe Config
```
Products to create in Stripe dashboard:
- Broflo Pro Monthly: $9.99/mo
- Broflo Pro Annual: $99/yr
- Broflo Elite Monthly: $24.99/mo
- Broflo Elite Annual: $249/yr

Webhook events to register:
- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- invoice.payment_failed
- invoice.payment_succeeded
```

### Feature Gate Middleware
```
NestJS guard: SubscriptionGuard
- @RequiresTier('pro') decorator
- Checks user.subscription_tier
- Returns 402 with { upgrade_url, message } on failure

Apply to:
- POST /persons (>3 persons = pro required)
- POST /autopilot/* (pro required)
- All gamification endpoints (pro required)
```

### Frontend
```
Pages:
- /app/upgrade/page.tsx            — pricing table
- /app/billing/page.tsx            — subscription management

Components:
- PricingTable — three-column shadcn Card grid (Free / Pro / Elite)
  - Feature checklist per tier
  - CTA buttons: "Get Pro" / "Get Elite" / "Current Plan"
  - Highlight Pro with info border accent
- UpgradePrompt — inline prompt shown when hitting a tier limit
  - Broflo copy: "You've hit the Free limit. Three people is a lot... 
    for a free tier. Upgrade and we'll remember everyone."
- BillingPage — current plan, next billing date, "Manage Billing" → Stripe portal
```

### shadcn/ui Components to Add
```
npx shadcn-ui@latest add alert
```

---

## Acceptance Test

```
1. Free user creates 3 people — succeeds
2. Free user creates 4th person — 402 returned, upgrade prompt shown
3. Click "Get Pro" → Stripe Checkout opens (test mode)
4. Complete checkout with test card 4242 4242 4242 4242
5. Redirected back to app — subscription_tier = 'pro' on User
6. Create 4th person — now succeeds
7. Navigate to /billing — shows Pro plan, next billing date
8. Click "Manage Billing" → Stripe portal opens
9. Cancel subscription via portal → webhook fires → tier reverts to 'free'
10. Simulate payment failure webhook → user email sent, tier downgraded
```

---

## Notes

- Stripe test mode for all dev/staging environments — never production keys in dev
- The stored `stripe_payment_method_id` is what S-7 will use to place orders on the user's behalf — ensure it's captured during Checkout and stored correctly
- Annual vs. monthly is a Stripe products config detail — the app only needs to know `subscription_tier`, not billing cadence
