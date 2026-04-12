---
phase: 07-first-retailer-api
plan: "04"
subsystem: database + frontend-integration
tags: [prisma, schema-push, orders, suggestions-view, dashboard, cancel-window]
dependency_graph:
  requires: ["07-01", "07-02", "07-03"]
  provides: ["live-orders-table", "suggestions-order-flow", "dashboard-cancel-badge"]
  affects: ["apps/api/prisma/schema.prisma", "apps/web/src/components/suggestions/suggestions-view.tsx", "apps/web/src/components/gifts/recent-gifts-widget.tsx"]
tech_stack:
  added: []
  patterns: ["prisma-db-push", "react-fragment-modal-pattern", "inline-component-for-countdown"]
key_files:
  created: []
  modified:
    - apps/web/src/components/suggestions/suggestions-view.tsx
    - apps/web/src/components/gifts/recent-gifts-widget.tsx
    - apps/api/src/orders/__tests__/orders.service.spec.ts
decisions:
  - "onOrderThis gated to pro/elite tier only — free users see no Order This button"
  - "giftRecordId captured from selectSuggestion response and passed to OrderPreviewModal"
  - "CancelCountdown rendered below suggestion card (not inside) for layout clarity"
  - "GiftOrderBadge is an inline component within RecentGiftsWidget — no separate file needed"
  - "orders fetch in RecentGiftsWidget uses status=ordered filter to minimize payload"
metrics:
  duration_minutes: 35
  completed_date: "2026-04-12"
  tasks_completed: 3
  tasks_total: 4
  files_modified: 3
---

# Phase 7 Plan 04: Integration + E2E Verification Summary

**One-liner:** Schema pushed to Azure PostgreSQL with orders table and gift_source enum; OrderPreviewModal wired into SuggestionsView with full order state management; dashboard RecentGiftsWidget shows live cancel countdown badge on ordered gifts.

## What Was Built

### Task 1: Database schema push (blocking prerequisite)
- Added `ordered` to `gift_source` enum via `ALTER TYPE ... ADD VALUE IF NOT EXISTS` (outside transaction per PostgreSQL requirement)
- Pushed full Prisma schema to Azure PostgreSQL (`broflo-db.postgres.database.azure.com`)
- Created `orders` table with all columns from Plan 01 schema
- Verified `persons` table has 5 shipping columns (`shipping_address1/2, city, state, zip`)
- Verified `order_status` enum exists with all 6 values
- Regenerated Prisma client (`v6.19.3`)
- API TypeScript compiles clean post-generate

### Task 2: Wire OrderPreviewModal into SuggestionsView
- Added `orderingSuggestionId` state — null when closed, set to suggestion ID when "Order This" clicked
- Added `orderedSuggestions` Map — tracks `{ orderId, status, placedAt }` per suggestion after order placed
- Added `suggestionGiftRecordIds` Map — captures `giftRecordId` from `selectSuggestion()` response for passing to modal
- Added `handleOrderThis`, `handleOrderPlaced`, `handleCancelCompleted` handlers
- `handleOrderPlaced` fires `toast.success(VOICE.orderSuccess)` then updates orderedSuggestions map
- SuggestionCard receives `onOrderThis` (gated to pro/elite only), `orderStatus`, `orderPlacedAt`
- `CancelCountdown` renders below ordered cards (status === 'ordered' and placedAt present)
- `OrderPreviewModal` renders at component root using React Fragment pattern

### Task 3: Cancel window badge on RecentGiftsWidget (D-10)
- Added `recentOrders` state: `Map<giftRecordId, { status, placedAt }>`
- Second `useEffect` fetches `GET /orders?status=ordered&limit=10` on mount, builds giftRecordId lookup map
- `GiftOrderBadge` inline component — calls `useCancelCountdown(placedAt)`, renders `OrderStatusBadge` with countdown, returns null when window closed
- Badge renders between gift title/date block and rating buttons in each gift row
- All existing rating/NailedIt/FeedbackDialog functionality preserved

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing StripeConnectService mock in orders.service.spec.ts**
- **Found during:** Task 4 pre-verification (running test suite)
- **Issue:** `orders.service.spec.ts` from Plan 01 didn't include `StripeConnectService` in the NestJS test module. Plan 02 added `StripeConnectService` as a constructor dependency on `OrdersService`, breaking all 4 service tests with "Nest can't resolve dependencies" error.
- **Fix:** Added `StripeConnectService` mock with `refund`, `createCharge`, `calculateFeeCents`, `getConnectedAccountId` methods. Added `stripePaymentIntentId: null` to all mock order objects.
- **Files modified:** `apps/api/src/orders/__tests__/orders.service.spec.ts`
- **Commit:** `dcfc06f`
- **Result:** All 13 tests pass (4 orders.service + 9 mock.adapter)

## Checkpoint: Task 4 — E2E Human Verification

**Status:** AWAITING — returned to orchestrator per `autonomous: false` directive.

Task 4 is a `checkpoint:human-verify` requiring manual browser testing of the complete order lifecycle. Automated prerequisites are satisfied:

| Check | Result |
|-------|--------|
| `orders` table in PostgreSQL | PASS |
| `persons` has 5 shipping columns | PASS |
| `gift_source` enum has `ordered` | PASS |
| `npx tsc --noEmit` (apps/api) | PASS |
| `npx tsc --noEmit` (apps/web) | PASS |
| orders unit tests (13 tests) | PASS |
| OrderPreviewModal wired in SuggestionsView | PASS |
| CancelCountdown renders on ordered suggestions | PASS |
| RecentGiftsWidget fetches orders + shows badge | PASS |

## Known Stubs

None. All components are wired to real API endpoints.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes beyond what the plan's threat model covers.

## Self-Check

**Commits:**
- `f0db9c2` — chore(07-04): push Prisma schema to Azure PostgreSQL
- `e056797` — feat(07-04): wire OrderPreviewModal into SuggestionsView
- `63ce1ad` — feat(07-04): add cancel window badge to RecentGiftsWidget (D-10)
- `dcfc06f` — fix(07-04): add StripeConnectService mock to orders.service.spec.ts

## Self-Check: PASSED

- suggestions-view.tsx: FOUND
- recent-gifts-widget.tsx: FOUND
- orders.service.spec.ts: FOUND
- All 4 commits present in git log
