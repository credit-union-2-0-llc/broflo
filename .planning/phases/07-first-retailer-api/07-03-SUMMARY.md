---
phase: 07-first-retailer-api
plan: 03
subsystem: web-frontend
tags: [orders, ui, react, shadcn, voice-copy]
dependency_graph:
  requires: ["07-01"]
  provides: ["order-preview-modal", "cancel-countdown", "cancel-dialog", "order-status-badge", "api-order-methods"]
  affects: ["apps/web/src/components/suggestions/suggestion-card.tsx"]
tech_stack:
  added: []
  patterns: ["controlled-dialog", "countdown-hook", "voice-copy-only"]
key_files:
  created:
    - apps/web/src/components/orders/order-preview-modal.tsx
    - apps/web/src/components/orders/cancel-dialog.tsx
    - apps/web/src/components/orders/cancel-countdown.tsx
    - apps/web/src/components/orders/order-status-badge.tsx
    - apps/web/src/hooks/use-cancel-countdown.ts
  modified:
    - apps/web/src/lib/api.ts
    - apps/web/src/components/suggestions/suggestion-card.tsx
    - packages/shared/src/copy/voice.ts
decisions:
  - "Used a sub-component (OrderActions) inside SuggestionCard to safely call useCancelCountdown hook (hooks must be called unconditionally at component level)"
  - "CancelDialog uses Button components directly in AlertDialogFooter rather than AlertDialogAction/AlertDialogCancel to enable loading spinner on the destructive action"
  - "Added order VOICE copy keys to voice.ts as root-level keys (not nested) to match the plan's interface spec"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-11"
  tasks_completed: 2
  files_modified: 8
requirements: [D-01, D-02, D-03, D-10, D-11]
---

# Phase 7 Plan 03: Frontend Order Flow Summary

Order flow frontend complete: "Order This" CTA on selected suggestion cards, full preview modal with editable shipping address, place-order confirm flow with loading state, Broflo-voice success toast, cancel countdown timer, and cancel confirmation dialog.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | API client methods + useCancelCountdown hook + OrderStatusBadge | c01d2d2 | api.ts, use-cancel-countdown.ts, order-status-badge.tsx, voice.ts |
| 2 | OrderPreviewModal + CancelDialog + CancelCountdown + SuggestionCard update | 569c7cb | order-preview-modal.tsx, cancel-dialog.tsx, cancel-countdown.tsx, suggestion-card.tsx |

## What Was Built

**OrderPreviewModal** (`apps/web/src/components/orders/order-preview-modal.tsx`): Calls `api.previewOrder` on open, shows product title/description/price/delivery estimate, pre-fills shipping address from Person data (all fields editable per D-02), displays cancel window disclosure using `VOICE.cancelWindow`, and places order via `api.placeOrder` with loading state. Success fires `VOICE.orderSuccess` toast and calls `onOrderPlaced` callback without page navigation (D-03).

**CancelDialog** (`apps/web/src/components/orders/cancel-dialog.tsx`): AlertDialog with `VOICE.orderCancelConfirm` title, `VOICE.orderCancelKeep` and `VOICE.orderCancelConfirmAction` buttons per D-11. Calls `api.cancelOrder` with loading spinner, fires `VOICE.orderCancel` toast on success.

**CancelCountdown** (`apps/web/src/components/orders/cancel-countdown.tsx`): Renders a destructive Button showing live countdown (e.g., "Cancel (1h 42m)"). Returns `null` when `canCancel` is false — completely hidden at expiry per Pitfall 4.

**OrderStatusBadge** (`apps/web/src/components/orders/order-status-badge.tsx`): Status-appropriate icon + label with optional countdown display for `ordered` status.

**useCancelCountdown** (`apps/web/src/hooks/use-cancel-countdown.ts`): 2-hour window countdown hook with formatted display string (`Xh Ym` / `Xm Ys` / `Xs`).

**SuggestionCard updates**: Added `onOrderThis`, `orderStatus`, and `orderPlacedAt` optional props. For selected suggestions: shows "Order This" button when no order status; shows `OrderStatusBadge` with live countdown when ordered.

**API client** (`apps/web/src/lib/api.ts`): Added 5 order methods (`previewOrder`, `placeOrder`, `cancelOrder`, `getOrders`, `getOrder`) and 5 interfaces (`RetailerProduct`, `OrderPreviewResponse`, `Order`, `OrderDetailResponse`, `OrderListResponse`). Updated `GiftRecord.source` to include `"ordered"`.

**voice.ts**: Added missing order copy keys (`orderSuccess`, `orderCancel`, `orderCancelConfirm`, `orderCancelKeep`, `orderCancelConfirmAction`, `orderPlacing`, `orderPreviewCta`, `orderFailed`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added order copy keys to voice.ts**
- **Found during:** Task 1 start
- **Issue:** Plan's `<interfaces>` section listed VOICE keys (`orderCancelConfirm`, `orderCancelKeep`, `orderCancelConfirmAction`, `orderPlacing`, `orderPreviewCta`, `orderFailed`) but they were absent from voice.ts. CLAUDE.md requires all UI strings to come from voice.ts.
- **Fix:** Added all missing keys to `packages/shared/src/copy/voice.ts` as root-level string constants.
- **Files modified:** `packages/shared/src/copy/voice.ts`
- **Commit:** c01d2d2

**2. [Rule 1 - Bug] Extracted OrderActions sub-component in SuggestionCard**
- **Found during:** Task 2
- **Issue:** `useCancelCountdown` hook needed to be called based on `orderStatus` but React rules require hooks at top level of a component. Calling conditionally would be invalid.
- **Fix:** Extracted an `OrderActions` inner component that always calls `useCancelCountdown` (passing `null` when not ordered) and conditionally renders.
- **Files modified:** `apps/web/src/components/suggestions/suggestion-card.tsx`
- **Commit:** 569c7cb

## Known Stubs

None. All components connect to real API methods. The `OrderPreviewModal` and `CancelDialog` call live endpoints. The mock adapter (from plan 07-01) will return realistic data during development.

## Threat Flags

None. All surfaces were in the plan's threat model:
- No `dangerouslySetInnerHTML` usage (T-07-15 mitigated)
- Token passed as prop, not from localStorage (T-07-16 mitigated)
- `placing` state disables "Confirm & Order" immediately on click (T-07-18 mitigated)

## Self-Check: PASSED

All files verified to exist and TypeScript compiles without errors.
