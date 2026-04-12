# Phase 7: First Retailer API - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 07-first-retailer-api
**Areas discussed:** Order Confirmation Flow, Commerce Module Placement, Mock Retailer Behavior, Cancel Window UX

---

## Order Confirmation Flow

### Q1: Order Preview Modal

| Option | Description | Selected |
|--------|-------------|----------|
| Full preview | Product title, description, price, delivery date, recipient address (editable), cancel window disclosure | ✓ |
| Minimal preview | Just title, price, confirm button. No address editing. | |
| Two-step flow | First modal = product details, second step = address confirmation. | |

**User's choice:** Full preview
**Notes:** None

### Q2: Recipient Address Source

| Option | Description | Selected |
|--------|-------------|----------|
| Person dossier | Add address fields to Person model. Pre-filled, editable per-order. | ✓ |
| Per-order entry only | User enters address fresh each time. No persistence. | |
| Address book | Separate AddressBook model with multiple addresses per user. | |

**User's choice:** Person dossier
**Notes:** None

### Q3: Post-Order Success UX

| Option | Description | Selected |
|--------|-------------|----------|
| Toast + status update | Sonner toast with Broflo voice, in-place status update, cancel button appears | ✓ |
| Confirmation page | Navigate to full order confirmation page | |
| Toast + redirect to orders | Toast then redirect to /orders page | |

**User's choice:** Toast + status update
**Notes:** None

---

## Commerce Module Placement

### Q4: Service Location

| Option | Description | Selected |
|--------|-------------|----------|
| NestJS module in apps/api | New OrdersModule alongside existing modules. Shares Prisma, auth, guards. | ✓ |
| Separate services/commerce | New microservice (FastAPI or NestJS). Own container, own deploy. | |
| Hybrid — API module now, extract later | Start as module, design for extraction. | |

**User's choice:** NestJS module in apps/api
**Notes:** None

### Q5: Stripe Connect Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — set up Connect platform | Register as Connect platform, create test connected accounts. | ✓ |
| Defer Connect — direct charge | Charge user, pay retailer separately. Broflo holds funds. | |
| Stub payment entirely | Mock adapter returns success without charges. | |

**User's choice:** Yes — set up Connect platform
**Notes:** Pre-decided by user before discussion started: "I don't want any transaction liability"

---

## Mock Retailer Behavior

### Q6: Mock Adapter Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Realistic simulation | Configurable delays, 95% success, 5% failure, mock order IDs | ✓ |
| Instant success | Always succeeds immediately. Fastest for dev. | |
| Failure-heavy | 50% failure rate for thorough error testing. | |

**User's choice:** Realistic simulation
**Notes:** None

### Q7: Product Search Simulation

| Option | Description | Selected |
|--------|-------------|----------|
| Full mock catalog | ~20 products, searchProducts() filters by keyword + budget | ✓ |
| Skip search — use suggestion data | Order preview uses AI suggestion data directly | |
| You decide | Claude picks based on implementation needs | |

**User's choice:** Full mock catalog
**Notes:** None

---

## Cancel Window UX

### Q8: Cancel Countdown Display

| Option | Description | Selected |
|--------|-------------|----------|
| Gift detail + dashboard badge | Cancel button with countdown on detail view, badge on dashboard cards | ✓ |
| Gift detail only | Cancel only visible on specific gift view | |
| Persistent nav indicator | Nav bar shows count of cancellable orders | |

**User's choice:** Gift detail + dashboard badge
**Notes:** None

### Q9: Cancel Action Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm dialog then cancel | Confirmation dialog, then cancel via retailer API, refund, status revert | ✓ |
| Instant cancel | One click cancels immediately, no confirmation | |

**User's choice:** Confirm dialog then cancel
**Notes:** None

---

## Claude's Discretion

- Order model schema design
- Audit log structure for order attempts
- Error handling granularity
- Loading/skeleton states

## Deferred Ideas

None
