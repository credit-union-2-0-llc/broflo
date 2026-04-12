---
phase: 07-first-retailer-api
plan: "02"
subsystem: orders/payments
tags: [stripe-connect, destination-charges, refunds, orders-service]
dependency_graph:
  requires: ["07-01"]
  provides: ["stripe-connect-charge", "stripe-connect-refund", "orders-stripe-integration"]
  affects: ["apps/api/src/orders/orders.service.ts", "apps/api/src/orders/orders.module.ts"]
tech_stack:
  added: []
  patterns:
    - "Stripe Connect destination charges with transfer_data.destination"
    - "Idempotency key on PaymentIntent creation (order-{orderId})"
    - "reverse_transfer: true on refunds to pull funds back from connected account"
    - "Graceful degradation when STRIPE_MOCK_RETAILER_ACCOUNT_ID not configured"
    - "Charge-before-retailer with auto-refund if retailer fails"
key_files:
  created:
    - apps/api/src/orders/stripe-connect.service.ts
  modified:
    - apps/api/src/orders/orders.service.ts
    - apps/api/src/orders/orders.module.ts
decisions:
  - "STRIPE_PLATFORM_FEE_BPS env var (default 500 = 5%) controls platform fee — not hardcoded"
  - "Graceful degradation: when no connected account configured, order proceeds without Stripe charge (mock flow works end-to-end without Stripe setup)"
  - "Charge-then-retailer sequence: if retailer fails after successful charge, auto-refund is issued immediately before marking order failed"
  - "reverse_transfer: true hardcoded in StripeConnectService.refund() — cannot be bypassed per request"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-04-11"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 7 Plan 02: Stripe Connect Integration Summary

**One-liner:** Stripe Connect destination charges with 5% platform fee, idempotency keys, and reverse_transfer refunds wired into OrdersService place/cancel lifecycle.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create StripeConnectService | 50b3526 | apps/api/src/orders/stripe-connect.service.ts, orders.module.ts |
| 2 | Wire into OrdersService place() and cancel() | 5994b76 | apps/api/src/orders/orders.service.ts |

## What Was Built

### StripeConnectService (`stripe-connect.service.ts`)

- `createCharge()`: Creates PaymentIntent with `transfer_data.destination` (routes funds to retailer's connected account), `application_fee_amount` (Broflo's 5% platform fee), and `confirm: true` for single-step charge of stored payment method. Idempotency key `order-{orderId}` prevents double charges on retry.
- `refund()`: Issues refund with `reverse_transfer: true` to pull funds back from the connected account. This is hardcoded — cannot be bypassed.
- `getConnectedAccountId()`: Maps retailer key to Stripe connected account ID. MVP supports `'mock'` key only via `STRIPE_MOCK_RETAILER_ACCOUNT_ID` env var.
- `calculateFeeCents()`: Computes platform fee from `STRIPE_PLATFORM_FEE_BPS` env var (default 500 = 5%).

### OrdersService updates

**place() sequence (with Stripe):**
1. Validate payment method present
2. Fetch suggestion + product from adapter
3. Create Order record (status: `pending`)
4. Stripe charge via `createCharge()` → update order with `stripePaymentIntentId`
5. Call `adapter.placeOrder()` → if adapter fails, auto-refund + mark `failed`
6. Update order to `ordered`, update GiftRecord, audit log

**place() graceful degradation:** When `STRIPE_MOCK_RETAILER_ACCOUNT_ID` is not set (or no connected account for retailer key), charge step is skipped with a warning log. Mock flow works end-to-end without Stripe Connect configured.

**cancel() sequence (with Stripe):**
1. Validate order ownership + 2-hour cancel window + cancellable status
2. If `order.stripePaymentIntentId` exists: refund via `stripeConnect.refund()` with `reverse_transfer: true`
3. Call `adapter.cancelOrder()`
4. Update order to `cancelled`, revert GiftRecord source, audit log

### Error paths (all audit-logged)

| Error | Audit action | Behavior |
|-------|-------------|----------|
| Stripe charge failed | `place_failed` + `reason: stripe_charge_failed` | Order marked `failed`, 500 thrown, no retailer call |
| Retailer failed after charge | `refund` (auto) + `place_failed` + `reason: retailer_failed_after_charge` | Auto-refund issued, order `failed` |
| Refund failed (critical) | `refund_failed` with paymentIntentId | CRITICAL log, order `failed` — manual resolution required |
| Cancel refund failed | `refund_failed` | 400 thrown, order not cancelled — contact support |

## Verification

- TypeScript: `tsc --noEmit` exits 0
- Unit tests: 13/13 pass (mock.adapter.spec.ts + orders.service.spec.ts)
- All acceptance criteria verified via grep

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. StripeConnectService degrades gracefully when `STRIPE_MOCK_RETAILER_ACCOUNT_ID` is not set — this is intentional behavior, not a stub. The mock flow (no real Stripe charge) is the default for development/test environments.

## Threat Flags

No new security surface beyond what the plan's threat model covers. All mitigations from T-07-08 through T-07-14 are implemented:

- T-07-08 (double charge): idempotency key `order-{orderId}` ✓
- T-07-09 (charge without order): PaymentIntent created after Order record exists ✓
- T-07-10 (failed refund): `refund_failed` audit with paymentIntentId for manual resolution ✓
- T-07-11 (key in logs): only `paymentIntent.id` (pi_*) logged, never secret key ✓
- T-07-12 (amount manipulation): `amountCents` from `adapter.getProduct()`, not client request ✓
- T-07-13 (fee manipulation): fee calculated server-side from env var ✓
- T-07-14 (missing reverse_transfer): hardcoded in `StripeConnectService.refund()` ✓

## Self-Check: PASSED

- `apps/api/src/orders/stripe-connect.service.ts` exists ✓
- `apps/api/src/orders/orders.service.ts` modified ✓
- `apps/api/src/orders/orders.module.ts` modified ✓
- Commit 50b3526 exists ✓
- Commit 5994b76 exists ✓
