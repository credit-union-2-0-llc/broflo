# Phase 7: First Retailer API - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Place real orders at retailers on the user's behalf via Stripe Connect. One-tap approve flow from AI suggestion to confirmed order. 2-hour cancel window on every order. Mock retailer adapter until real API credentials secured. This phase delivers the full order lifecycle: preview, confirm, place, cancel.

</domain>

<decisions>
## Implementation Decisions

### Order Confirmation Flow
- **D-01:** Full preview modal when user clicks "Order This" on a suggestion. Shows: product title, description, retailer price, estimated delivery date, recipient address (pre-filled from person dossier, editable per-order), 2-hour cancel window disclosure with Broflo voice copy.
- **D-02:** Recipient shipping address stored on Person model (new fields: address1, address2, city, state, zip). Pre-filled in order modal, user can override per-order. Override is stored on the Order record, not written back to Person.
- **D-03:** After successful order: Sonner toast with Broflo voice ("Done. She has no idea how easy that was."), gift status updates in-place to "ordered", cancel button appears with live countdown. No page navigation.

### Commerce Module Architecture
- **D-04:** New `OrdersModule` in `apps/api/src/orders/` alongside existing modules. Shares Prisma, auth, guards. No separate microservice for MVP.
- **D-05:** `RetailerAdapter` interface defined in `orders/adapters/retailer.adapter.ts` with implementations: `MockAdapter` (immediate), `FlowersAdapter` (future), `AmazonAdapter` (future).
- **D-06:** Stripe Connect platform setup is in-scope. Register Broflo as a Connect platform, create test connected accounts. PaymentIntent with transfer to connected account. Broflo takes a platform fee. Mock adapter simulates the charge flow against a test connected account.

### Mock Retailer Behavior
- **D-07:** Realistic simulation with configurable delays (1-3s for search, 2-3s for order placement). 95% success rate, 5% random failure for testing error paths.
- **D-08:** Full mock product catalog (~20 items across categories: flowers, gift baskets, candles, spa sets). `searchProducts()` filters by keyword + budget range. AI suggestion's `retailerHint` used to match products.
- **D-09:** Cancel behavior: succeeds within 2-hour window, returns `CancelError` after window expires. Order status progression: ordered -> processing -> shipped (simulated via getOrderStatus).

### Cancel Window UX
- **D-10:** Cancel button with live countdown timer on gift/order detail view. Dashboard shows badge/indicator on recently ordered gifts still within cancel window. No persistent nav bar indicator.
- **D-11:** Cancel flow: confirmation dialog ("Cancel this order? The gift won't be delivered.") with "Yes, Cancel" / "Keep It" buttons. On cancel: Stripe refund initiated, retailer cancel API called, gift status reverts to "approved" (suggestion stays selected), toast confirms cancellation.

### Payment Architecture (Pre-decided)
- **D-12:** Stripe Connect (Option A) — Broflo never holds funds. No transaction liability. User pays via PaymentIntent with automatic transfer to retailer's connected account.

### Claude's Discretion
- Order model schema design (fields, indexes, relations)
- Audit log structure for order attempts
- Error handling granularity (retry logic, fallback behavior)
- Loading/skeleton states during order placement

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Slice Spec
- `docs/slices/S7-first-retailer-api.md` — Full slice spec with acceptance test, tech tasks, pre-ship checklist

### Existing Code (Integration Points)
- `apps/api/src/suggestions/suggestions.service.ts` — `selectSuggestion()` is the handoff point; creates GiftRecord from suggestion
- `apps/api/src/gifts/gifts.service.ts` — GiftRecord CRUD, Broflo Score logic
- `apps/api/src/billing/billing.service.ts` — Stripe SDK setup, customer management, `stripePaymentMethodId` on User
- `apps/api/prisma/schema.prisma` — Current models: GiftSuggestion (has `retailerHint`), GiftRecord (has `source` enum), User (has Stripe fields)
- `packages/shared/src/copy/voice.ts` — Brand voice copy (all UI strings must come from here)

### UI Components
- `apps/web/src/components/ui/dialog.tsx` — For order preview modal
- `apps/web/src/components/ui/sheet.tsx` — For mobile order detail
- `apps/web/src/components/ui/sonner.tsx` — For success/cancel toasts

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Dialog component** (shadcn): Use for order preview modal
- **Sheet component** (shadcn): Use for mobile order detail slide-over
- **Sonner** (shadcn): Toast notifications for order success/cancel
- **Badge component**: For order status indicators on dashboard
- **Skeleton component**: For loading states during order placement
- **`@RequiresTier()` decorator**: Gate ordering to Pro/Elite tiers
- **`@CurrentUser()` decorator**: Extract user from JWT in controllers
- **`RedisService`**: Cache and rate limiting patterns established

### Established Patterns
- **NestJS module structure**: Module + Controller + Service + DTO pattern (see billing, gifts, suggestions)
- **Prisma service injection**: `PrismaService` injected into all services
- **Error handling**: NestJS built-in exceptions (NotFoundException, ForbiddenException, BadRequestException)
- **API client pattern** (`apps/web/src/lib/api.ts`): ApiError class with status code preservation
- **Tier gating**: `TIER_MAX_*` constants + `SubscriptionGuard` pattern

### Integration Points
- **Suggestion -> Order**: `selectSuggestion()` creates GiftRecord with `source: 'suggestion'`. Order flow extends this — after selecting, user can click "Order This"
- **GiftSource enum**: Currently `suggestion | manual` — needs `ordered` value added
- **User.stripePaymentMethodId**: Available from S-6 checkout flow for Stripe Connect charges
- **Person model**: Needs shipping address fields added

</code_context>

<specifics>
## Specific Ideas

- Order preview modal layout matches the "Full preview" mockup: product info, price, delivery estimate, recipient address with edit capability, cancel window disclosure
- Dashboard cards show cancel countdown badge (e.g., "1h 42m") on recently ordered gifts
- Cancel confirmation dialog uses Broflo voice: "Order cancelled. No charge. Try a different gift?"
- Success toast: "Done. She has no idea how easy that was. Keep it that way."
- Mock catalog is flower/gift-themed (~20 items) to simulate 1-800-Flowers inventory

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-first-retailer-api*
*Context gathered: 2026-04-11*
