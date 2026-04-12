---
phase: 07-first-retailer-api
plan: 01
subsystem: orders-backend
tags: [orders, retailer-adapter, mock-adapter, prisma, nestjs, unit-tests]
dependency_graph:
  requires: []
  provides: [orders-module, retailer-adapter-interface, mock-adapter, order-lifecycle-api]
  affects: [apps/api/prisma/schema.prisma, apps/api/src/app.module.ts, packages/shared/src/copy/voice.ts]
tech_stack:
  added: [OrderStatus enum, Order model, RetailerAdapter interface, MockAdapter, OrderAuditService]
  patterns: [NestJS DI injection token RETAILER_ADAPTER, OPS-Platform audit POST, 2-hour cancel window]
key_files:
  created:
    - apps/api/src/orders/adapters/retailer.adapter.ts
    - apps/api/src/orders/adapters/mock/mock.adapter.ts
    - apps/api/src/orders/adapters/mock/mock-catalog.ts
    - apps/api/src/orders/orders.service.ts
    - apps/api/src/orders/orders.controller.ts
    - apps/api/src/orders/orders.module.ts
    - apps/api/src/orders/dto/preview-order.dto.ts
    - apps/api/src/orders/dto/place-order.dto.ts
    - apps/api/src/orders/dto/cancel-order.dto.ts
    - apps/api/src/orders/dto/list-orders.dto.ts
    - apps/api/src/orders/audit/order-audit.service.ts
    - apps/api/src/orders/__tests__/mock.adapter.spec.ts
    - apps/api/src/orders/__tests__/orders.service.spec.ts
  modified:
    - apps/api/prisma/schema.prisma
    - apps/api/src/app.module.ts
    - packages/shared/src/copy/voice.ts
decisions:
  - "MockAdapter returns 20-item catalog across 7 categories with configurable 1-3s delays and 5% failure rate"
  - "GiftSource.ordered added to enum for tracking ordered gifts in GiftRecord"
  - "OrderStatus enum does not include 'preview' - preview is stateless and never persisted"
  - "OrderAuditService posts to OPS-Platform /api/audit/log with x-api-key header per cu2-standards; falls back to local Logger on failure"
  - "Platform fee is 5% of product price (Math.round(priceCents * 0.05))"
  - "Stripe PaymentIntent creation deferred to Plan 02 - mock adapter path works without charge"
metrics:
  duration: "~25 minutes"
  completed_date: "2026-04-12"
  tasks_completed: 3
  files_created: 13
  files_modified: 3
---

# Phase 7 Plan 01: OrdersModule Backend Core Summary

**One-liner:** NestJS OrdersModule with RetailerAdapter pattern, 20-item MockAdapter catalog, 5-endpoint REST API, 2-hour cancel window enforcement, and OPS-Platform audit integration.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Prisma schema + RetailerAdapter + MockAdapter + voice | ad48f77 | schema.prisma, retailer.adapter.ts, mock.adapter.ts, mock-catalog.ts, voice.ts |
| 2 | OrdersModule + Controller + Service + DTOs + AppModule | b712094 | orders.service.ts, orders.controller.ts, orders.module.ts, 4 DTOs, audit service |
| 3 | Unit tests (TDD) | 751b4c3 | mock.adapter.spec.ts, orders.service.spec.ts |

## What Was Built

### Prisma Schema Additions
- `Order` model with 28 fields covering full order lifecycle (status, shipping, pricing, retailer refs)
- `OrderStatus` enum: pending, ordered, processing, shipped, cancelled, failed
- `GiftSource.ordered` added to existing enum
- Shipping address fields on `Person` model (shippingAddress1/2, shippingCity, shippingState, shippingZip)
- Relations: User/Person/Event all get `orders Order[]`; GiftRecord gets `order Order?`

### RetailerAdapter Interface
- Interface with 5 methods: searchProducts, getProduct, placeOrder, cancelOrder, getOrderStatus
- Supporting types: ShippingAddress, RetailerProduct, OrderResult, CancelResult, OrderStatusResult
- `RetailerOrderError` class with typed `code` field

### MockAdapter (20-item catalog)
- 6 flowers, 4 gift baskets (incl. spa), 3 candles, 3 spa sets, 2 gourmet food, 2 experience/misc
- 1-3 second simulated delays on searchProducts
- 2-3 second delay on placeOrder
- 5% random failure rate on placeOrder (MOCK_FAILURE error code)
- Internal Map tracks placed orders for status progression and cancel validation

### OrdersService
- `preview`: searches adapter, returns best match with person shipping info — no DB writes
- `place`: validates payment method, creates Order record, calls adapter, updates with retailer refs
- `cancel`: enforces 2-hour window, validates status, calls adapter cancel, reverts GiftRecord source
- `list`: paginated with optional status filter, includes person name
- `getById`: includes person name + giftRecord, computes `cancelWindowSecondsLeft`

### OrdersController (5 endpoints)
- `POST /orders/preview` — RequiresTier('pro', 'elite')
- `POST /orders/place` — RequiresTier('pro', 'elite')
- `POST /orders/:id/cancel` — RequiresTier('pro', 'elite')
- `GET /orders` — paginated list
- `GET /orders/:id` — single order with cancel countdown

### OrderAuditService
- Posts to `OPS_PLATFORM_URL/api/audit/log` with `x-api-key: OPS_PLATFORM_API_KEY`
- Logs all order actions: preview, place, place_failed, cancel, cancel_failed, refund, refund_failed
- Non-blocking — logs warning and continues on OPS-Platform POST failure

### Brand Voice
- 7 new keys: orderCancel, orderFailed, orderCancelConfirm, orderCancelKeep, orderCancelConfirmAction, orderPlacing, orderPreviewCta

## Test Results

```
Test Suites: 2 passed, 2 total
Tests:       13 passed, 13 total
```

MockAdapter: 8 tests (searchProducts filter/budget/sort/empty, getProduct found/not-found, placeOrder shape, cancelOrder success)
OrdersService: 4 tests (cancel expired window, cancel valid, cancel wrong status, cancel wrong user)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DTO strict mode property initialization**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** Strict TypeScript requires definite assignment assertion (`!`) on non-optional DTO properties
- **Fix:** Added `!` suffix to all non-optional DTO string fields in PreviewOrderDto and PlaceOrderDto
- **Files modified:** apps/api/src/orders/dto/preview-order.dto.ts, apps/api/src/orders/dto/place-order.dto.ts
- **Commit:** b712094

**2. [Rule 1 - Bug] Prisma `where.status` type mismatch in list()**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** Prisma's `OrderWhereInput.status` expects `OrderStatus` enum, not `string`
- **Fix:** Imported `OrderStatus` from `@prisma/client`, typed `where.status` as `OrderStatus`, cast `query.status as OrderStatus`
- **Files modified:** apps/api/src/orders/orders.service.ts
- **Commit:** b712094

**3. [Rule 3 - Blocking] Prisma client not regenerated after schema changes**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** The worktree symlinks node_modules from main repo; main repo's generated Prisma client predates the new Order model and Person shipping fields
- **Fix:** Ran `prisma generate` pointing at worktree schema, regenerating client in main repo's node_modules
- **Impact:** None — schema is identical in both repos for this plan

**4. [Rule 3 - Blocking] Worktree missing node_modules**
- **Found during:** Task 1 TypeScript compilation attempt
- **Issue:** Git worktree does not inherit node_modules from the main repo
- **Fix:** Symlinked `/Users/kirkdrake/broflo/apps/api/node_modules` into the worktree api directory
- **Impact:** None — symlink approach is standard for pnpm monorepo worktrees

## Known Stubs

None — all service methods are fully implemented. MockAdapter provides realistic simulation of retailer behavior. The `stripePaymentIntentId` is intentionally `null` in `place()` — this is documented in the plan and will be wired in Plan 02 (Stripe Connect).

## Threat Flags

None — all STRIDE mitigations from the plan's threat model were implemented as specified:
- T-07-01: @IsString + @MaxLength(200) on all address fields in PlaceOrderDto
- T-07-02: cancel() filters by userId via `prisma.order.findFirst({ where: { id, userId } })`
- T-07-03: @RequiresTier('pro', 'elite') + UseGuards(SubscriptionGuard) on all mutation routes
- T-07-04: GiftRecord update filtered by userId
- T-07-05: All queries filter by authenticated userId
- T-07-07: Suggestion ownership verified before any action

## Self-Check: PASSED

All 9 key files found. All 3 task commits verified (ad48f77, b712094, 751b4c3).
