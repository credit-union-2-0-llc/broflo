# Phase 7: First Retailer API - Research

**Researched:** 2026-04-11
**Domain:** Stripe Connect + NestJS OrdersModule + Mock Retailer Adapter + Order Lifecycle UX
**Confidence:** HIGH (all critical decisions verified against live codebase and official Stripe docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Full preview modal on "Order This" — product title, description, retailer price, estimated delivery date, recipient address (pre-filled from Person, editable), 2-hour cancel window disclosure with Broflo voice copy.
- **D-02:** Recipient shipping address stored on Person model (new fields: address1, address2, city, state, zip). Override stored on Order record, not written back to Person.
- **D-03:** After successful order: Sonner toast with Broflo voice, gift status updates in-place to "ordered", cancel button appears with live countdown. No page navigation.
- **D-04:** New `OrdersModule` in `apps/api/src/orders/` alongside existing modules. Shares Prisma, auth, guards. No separate microservice for MVP.
- **D-05:** `RetailerAdapter` interface in `orders/adapters/retailer.adapter.ts` with `MockAdapter`, `FlowersAdapter` (future), `AmazonAdapter` (future) implementations.
- **D-06:** Stripe Connect platform setup in-scope. Broflo registered as Connect platform. PaymentIntent with transfer to connected account. Broflo takes platform fee. Mock adapter simulates charge flow against test connected account.
- **D-07:** Mock adapter — configurable delays (1-3s search, 2-3s order), 95% success / 5% random failure.
- **D-08:** Mock product catalog ~20 items (flowers, gift baskets, candles, spa sets). `searchProducts()` filters by keyword + budget range. `retailerHint` from GiftSuggestion used to match.
- **D-09:** Cancel behavior — succeeds within 2-hour window, returns `CancelError` after window. Order status progression: ordered -> processing -> shipped (simulated via `getOrderStatus`).
- **D-10:** Cancel button with live countdown timer on gift/order detail. Dashboard badge on recently ordered gifts within cancel window. No persistent nav bar indicator.
- **D-11:** Cancel flow — confirmation dialog, on confirm: Stripe refund initiated, retailer cancel API called, gift status reverts to "approved" (suggestion stays selected), toast confirms.
- **D-12:** Stripe Connect (Option A) — Broflo never holds funds. User pays via PaymentIntent with automatic transfer to retailer's connected account.

### Claude's Discretion

- Order model schema design (fields, indexes, relations)
- Audit log structure for order attempts
- Error handling granularity (retry logic, fallback behavior)
- Loading/skeleton states during order placement

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

## Summary

Phase 7 implements the full order lifecycle: preview, confirm, place, cancel. The core work is threefold: (1) schema additions to Person and GiftRecord plus a new Order model, (2) a NestJS OrdersModule with a RetailerAdapter interface and MockAdapter, and (3) Stripe Connect platform setup for destination charges.

The existing codebase is well-prepared. Stripe SDK v22 is already installed and configured in `BillingService`. The `JwtAuthGuard` + `SubscriptionGuard` + `RequiresTier` decorator pattern is established. All shadcn/ui components needed (Dialog, Sheet, Sonner, Badge, Skeleton) are already installed. The `GiftSuggestion.retailerHint` field is already populated by the AI service.

The highest-complexity work is Stripe Connect: registering Broflo as a platform, provisioning test connected accounts for each simulated retailer, and wiring destination charges with `transfer_data[destination]` + `application_fee_amount`. The Mock adapter must simulate this charge flow realistically so that the real adapter swap is minimal.

**Primary recommendation:** Build the OrdersModule and MockAdapter first (no Stripe Connect needed), get the full UI flow working end-to-end, then layer in Stripe Connect. This isolates the riskiest integration and lets UI/UX be validated independently.

---

## Standard Stack

### Core (already installed) [VERIFIED: apps/api/package.json]

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stripe | ^22.0.1 | Stripe Connect + PaymentIntents | Already in BillingService, same pattern extends |
| @nestjs/common | ^11.0.0 | OrdersModule, guards, decorators | All existing modules use this |
| @prisma/client | ^6.0.0 | Order + Person schema additions | Established ORM throughout |

### Supporting (already installed) [VERIFIED: codebase grep]

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | shadcn wrapper | Order success / cancel toasts | Already used for other notifications |
| @radix-ui/react-dialog | shadcn wrapper | Order preview modal | `apps/web/src/components/ui/dialog.tsx` exists |
| @radix-ui/react-sheet | shadcn wrapper | Mobile order detail | `apps/web/src/components/ui/sheet.tsx` exists |
| lucide-react | installed | Countdown timer icon, status icons | Consistent with existing icon usage |

### Nothing new to install

All dependencies for this phase are already present. No `npm install` step required.

---

## Architecture Patterns

### New Module Structure

```
apps/api/src/orders/
├── orders.module.ts
├── orders.controller.ts
├── orders.service.ts
├── dto/
│   ├── preview-order.dto.ts
│   ├── place-order.dto.ts
│   └── cancel-order.dto.ts
├── adapters/
│   ├── retailer.adapter.ts       # interface
│   └── mock/
│       ├── mock.adapter.ts
│       └── mock-catalog.ts       # ~20 products
└── audit/
    └── order-audit.service.ts
```

### Pattern 1: RetailerAdapter Interface

**What:** TypeScript interface that all retailer implementations must satisfy. Injected into OrdersService via NestJS dependency injection token.

**When to use:** Every retailer interaction goes through this interface — never call adapter methods directly from controller.

```typescript
// Source: D-05 from CONTEXT.md + established NestJS DI pattern
export interface RetailerProduct {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
  estimatedDeliveryDays: number;
  retailerHint: string;
}

export interface OrderResult {
  retailerOrderId: string;
  confirmationNumber: string;
  estimatedDeliveryDate: string;
  actualPriceCents: number;
}

export interface CancelResult {
  success: boolean;
  reason?: string;
}

export interface RetailerAdapter {
  readonly retailerKey: string;  // 'mock' | 'flowers' | 'amazon'
  searchProducts(keywords: string, budgetMinCents: number, budgetMaxCents: number): Promise<RetailerProduct[]>;
  getProduct(productId: string): Promise<RetailerProduct>;
  placeOrder(product: RetailerProduct, shippingAddress: ShippingAddress, stripePaymentIntentId: string): Promise<OrderResult>;
  cancelOrder(retailerOrderId: string): Promise<CancelResult>;
  getOrderStatus(retailerOrderId: string): Promise<OrderStatus>;
}
```

### Pattern 2: Stripe Connect Destination Charges

**What:** Broflo creates a PaymentIntent on its own platform account. The `transfer_data.destination` routes funds to the retailer's connected account automatically. `application_fee_amount` deducts Broflo's platform fee.

**When to use:** Every real order placement. Mock adapter skips this and logs a simulated payment intent ID.

```typescript
// Source: [CITED: docs.stripe.com/connect/destination-charges]
const paymentIntent = await this.stripe.paymentIntents.create({
  amount: product.priceCents,
  currency: 'usd',
  customer: user.stripeCustomerId,
  payment_method: user.stripePaymentMethodId,
  confirm: true,
  transfer_data: {
    destination: connectedAccountId,  // retailer's Stripe account ID
  },
  application_fee_amount: Math.round(product.priceCents * 0.05), // 5% platform fee
  metadata: {
    brofloOrderId: order.id,
    brofloUserId: user.id,
  },
});
```

**Refund with transfer reversal:**
```typescript
// Source: [CITED: docs.stripe.com/connect/destination-charges]
await this.stripe.refunds.create({
  payment_intent: order.stripePaymentIntentId,
  reverse_transfer: true,  // pulls funds back from connected account
});
```

### Pattern 3: Mock Adapter Simulation

**What:** Implements `RetailerAdapter` with in-memory product catalog. Uses `setTimeout` wrappers to simulate realistic latency. Uses `Math.random()` against configurable thresholds for success/failure simulation.

```typescript
// Source: D-07, D-08, D-09 from CONTEXT.md
async placeOrder(...): Promise<OrderResult> {
  // 2-3s simulated delay
  await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));

  // 5% failure rate
  if (Math.random() < 0.05) {
    throw new RetailerOrderError('Mock: simulated order failure', 'MOCK_FAILURE');
  }

  return {
    retailerOrderId: `MOCK-${Date.now()}`,
    confirmationNumber: `CONF-${Math.random().toString(36).slice(2,8).toUpperCase()}`,
    estimatedDeliveryDate: addDays(new Date(), 3 + Math.floor(Math.random() * 4)).toISOString(),
    actualPriceCents: product.priceCents,
  };
}
```

### Pattern 4: Cancel Window Enforcement

**What:** `Order.placedAt` timestamp compared to `now()` at cancel time. Window is 2 hours (7200 seconds). Both backend and frontend enforce/display this — backend is authoritative.

```typescript
// Source: D-09, D-11 from CONTEXT.md
const withinWindow = (Date.now() - order.placedAt.getTime()) < 2 * 60 * 60 * 1000;
if (!withinWindow) {
  throw new BadRequestException('Cancel window has closed. Order cannot be cancelled.');
}
```

Frontend countdown computed from `order.placedAt + 2h - now()` using `setInterval`. When countdown reaches 0, cancel button disappears without page reload.

### Pattern 5: Order Preview Flow (no payment until confirm)

**What:** `POST /orders/preview` is a read-only operation — it calls `adapter.searchProducts()` with the suggestion's `retailerHint` and budget range, returns the best match. No charge, no order record created. Only `POST /orders/place` creates records and charges.

This is critical: do not persist anything during preview. Preview is stateless.

### Anti-Patterns to Avoid

- **Charging before confirming:** Never create a PaymentIntent during `/preview`. Only on `/place`.
- **Writing shipping address back to Person:** Per D-02, the per-order override is stored on the Order record only.
- **Navigation after order:** Per D-03, no page redirect after success. Status updates in-place.
- **Blocking GiftSource enum migration:** Adding `ordered` to `GiftSource` is a Prisma migration — must be tested before deploying.
- **Skipping `reverse_transfer` on refund:** Default Stripe behavior keeps funds in the connected account when a platform refund is issued. Always pass `reverse_transfer: true`.

---

## Schema Additions Required

### Person model — new shipping address fields [VERIFIED: apps/api/prisma/schema.prisma]

```prisma
// Add to model Person
shippingAddress1  String?   @map("shipping_address1")
shippingAddress2  String?   @map("shipping_address2")
shippingCity      String?   @map("shipping_city")
shippingState     String?   @map("shipping_state")
shippingZip       String?   @map("shipping_zip")
```

### GiftSource enum — add `ordered` value [VERIFIED: current schema has only suggestion | manual]

```prisma
enum GiftSource {
  suggestion
  manual
  ordered   // NEW — S-7

  @@map("gift_source")
}
```

### New Order model

```prisma
model Order {
  id                    String      @id @default(uuid())
  userId                String      @map("user_id")
  personId              String      @map("person_id")
  eventId               String?     @map("event_id")
  giftRecordId          String?     @unique @map("gift_record_id")
  suggestionId          String?     @map("suggestion_id")
  retailerKey           String      @map("retailer_key")          // 'mock' | 'flowers'
  retailerProductId     String      @map("retailer_product_id")
  retailerOrderId       String?     @map("retailer_order_id")     // null until placed
  confirmationNumber    String?     @map("confirmation_number")
  productTitle          String      @map("product_title")
  productDescription    String?     @map("product_description")
  productImageUrl       String?     @map("product_image_url")
  priceCents            Int         @map("price_cents")
  platformFeeCents      Int         @default(0) @map("platform_fee_cents")
  stripePaymentIntentId String?     @map("stripe_payment_intent_id")
  status                OrderStatus @default(preview)
  // Shipping address snapshot (per-order override)
  shippingName          String      @map("shipping_name")
  shippingAddress1      String      @map("shipping_address1")
  shippingAddress2      String?     @map("shipping_address2")
  shippingCity          String      @map("shipping_city")
  shippingState         String      @map("shipping_state")
  shippingZip           String      @map("shipping_zip")
  estimatedDeliveryDate DateTime?   @map("estimated_delivery_date")
  placedAt              DateTime?   @map("placed_at")
  cancelledAt           DateTime?   @map("cancelled_at")
  cancelReason          String?     @map("cancel_reason")
  createdAt             DateTime    @default(now()) @map("created_at")
  updatedAt             DateTime    @updatedAt @map("updated_at")

  user       User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  person     Person          @relation(fields: [personId], references: [id], onDelete: Cascade)
  event      Event?          @relation(fields: [eventId], references: [id], onDelete: SetNull)
  giftRecord GiftRecord?     @relation(fields: [giftRecordId], references: [id], onDelete: SetNull)

  @@index([userId, status, placedAt], map: "idx_orders_user_status")
  @@index([personId, placedAt], map: "idx_orders_person_placed")
  @@map("orders")
}

enum OrderStatus {
  preview      // UI only — no DB record at this stage
  pending      // place called, not yet confirmed by retailer
  ordered      // retailer confirmed
  processing   // retailer is processing
  shipped      // in transit
  cancelled    // cancelled within window
  failed       // order attempt failed

  @@map("order_status")
}
```

Note: `GiftRecord` needs a reciprocal `Order?` relation added. The `orders` relation field must also be added to `User`, `Person`, `Event`, and `GiftRecord` models.

---

## API Endpoints

### OrdersController routes [VERIFIED: D-04 + S7 slice spec]

```
POST /orders/preview          — stateless, returns best product match from adapter
POST /orders/place            — creates Order record, charges via Stripe Connect, calls adapter
POST /orders/:id/cancel       — validates 2h window, refunds, calls adapter.cancelOrder
GET  /orders                  — paginated order history for authenticated user
GET  /orders/:id              — single order detail
```

All routes require auth (JWT guard is global). `/orders/place` requires `@RequiresTier('pro', 'elite')` — ordering is a paid feature.

---

## Stripe Connect Setup Steps

**Tier: 3 — Kirk sign-off required (financial integration)** [VERIFIED: cu2-standards Tier classification]

These are one-time platform configuration steps, not per-request code:

1. Enable Connect in Stripe Dashboard (platform settings)
2. Create a test connected account to represent "Mock Retailer" (`stripe.accounts.create({ type: 'express' })`) — store the account ID as env var `STRIPE_MOCK_RETAILER_ACCOUNT_ID`
3. Add `STRIPE_MOCK_RETAILER_ACCOUNT_ID` to `cu2-apps-kv` Azure Key Vault
4. For Mock adapter: use this account ID as `transfer_data.destination` in test mode

No Stripe Connect onboarding flow needed for MVP — the "connected accounts" are internal test accounts created programmatically for the mock retailer simulation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Countdown timer | Custom class with tick | `setInterval` + `useEffect` React hook | No library needed, 10 lines |
| Stripe refund | Custom refund logic | `stripe.refunds.create({ reverse_transfer: true })` | Official SDK handles edge cases |
| Payment idempotency | Manual dedup | `idempotencyKey` on Stripe API calls | Stripe handles duplicate charges on retry |
| Address validation | Custom regex | None for MVP — text input with basic required fields | No retailer requires validated addresses in MVP scope |
| Order status polling | Cron + DB writes | Mock adapter simulates via `getOrderStatus` | Real polling added in S-8 (tracking) |

**Key insight:** The Mock adapter's purpose is to validate the interface, not simulate real latency precisely. Keep it simple — the real retailer adapter is S-8/S-9 work.

---

## Common Pitfalls

### Pitfall 1: PaymentIntent confirm race condition
**What goes wrong:** Frontend calls `/place`, Stripe charges before retailer API succeeds, then retailer fails — user is charged but no order placed.
**Why it happens:** Charge and order placement are two separate API calls.
**How to avoid:** Charge Stripe first. If retailer call fails, immediately refund (`stripe.refunds.create`). Log both outcomes to the OrderAuditLog. Never leave a charge without a corresponding order record.
**Warning signs:** Order audit log shows `stripePaymentIntentId` set but `retailerOrderId` is null.

### Pitfall 2: Missing `reverse_transfer` on refund
**What goes wrong:** Platform refunds user but connected account (mock retailer) keeps the funds. Platform account goes negative.
**Why it happens:** Default Stripe behavior for destination charges does NOT auto-reverse the transfer.
**How to avoid:** Always pass `reverse_transfer: true` in `stripe.refunds.create`. [CITED: docs.stripe.com/connect/destination-charges]
**Warning signs:** Platform balance goes negative in Stripe dashboard after cancellations.

### Pitfall 3: Prisma enum migration in production
**What goes wrong:** Adding `ordered` to `GiftSource` enum requires a raw SQL `ALTER TYPE` in PostgreSQL — `prisma migrate` alone may fail if the enum already has rows.
**Why it happens:** PostgreSQL enum alterations can't be transactional in all versions.
**How to avoid:** Add the new value with `ALTER TYPE "gift_source" ADD VALUE 'ordered'` as a raw migration step. Test against the Azure PostgreSQL instance before deploying.
**Warning signs:** Migration fails with "cannot add enum value within a transaction".

### Pitfall 4: Cancel button visible after window closes (stale state)
**What goes wrong:** User sees cancel button after 2-hour window; clicks it; gets a 400 error with no clear explanation.
**Why it happens:** React component countdown reaches 0 but button isn't hidden.
**How to avoid:** When countdown reaches 0, set local state `windowOpen = false` and hide the button (don't just disable it). Backend still validates — this is a UX safeguard.
**Warning signs:** Users report "cancel didn't work" after 2 hours.

### Pitfall 5: Suggestion-to-order handoff state confusion
**What goes wrong:** `selectSuggestion()` creates/updates a GiftRecord. Then placing an order also touches GiftRecord. If not coordinated, you get duplicate records or orphaned suggestions.
**Why it happens:** S-4/S-5 patterns assume suggestion -> GiftRecord is the final step. S-7 adds another step.
**How to avoid:** `/orders/place` receives the `giftRecordId` from the existing GiftRecord (created by `selectSuggestion`). It updates that record's status to reflect the order, rather than creating a new one. The `Order` model has a `giftRecordId` FK.
**Warning signs:** Two GiftRecord rows for the same eventId + userId + source='suggestion'.

---

## Code Examples

### OrdersController structure [VERIFIED: established NestJS pattern from billing.controller.ts]

```typescript
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('preview')
  @RequiresTier('pro', 'elite')
  async preview(@CurrentUser() user: User, @Body() dto: PreviewOrderDto) {
    return this.orders.preview(user, dto);
  }

  @Post('place')
  @RequiresTier('pro', 'elite')
  async place(@CurrentUser() user: User, @Body() dto: PlaceOrderDto) {
    return this.orders.place(user, dto);
  }

  @Post(':id/cancel')
  @RequiresTier('pro', 'elite')
  async cancel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.orders.cancel(user.id, id);
  }

  @Get()
  async list(@CurrentUser() user: User, @Query() query: ListOrdersDto) {
    return this.orders.list(user.id, query);
  }

  @Get(':id')
  async get(@CurrentUser() user: User, @Param('id') id: string) {
    return this.orders.getById(user.id, id);
  }
}
```

### Mock catalog structure [VERIFIED: D-08 from CONTEXT.md]

```typescript
// apps/api/src/orders/adapters/mock/mock-catalog.ts
export const MOCK_CATALOG: RetailerProduct[] = [
  { id: 'mock-001', title: 'Classic Rose Bouquet', description: '24 long-stem red roses', priceCents: 7999, imageUrl: null, estimatedDeliveryDays: 2, retailerHint: 'flowers' },
  { id: 'mock-002', title: 'Spa Day Gift Basket', description: 'Lavender bath bombs, candles, robe', priceCents: 8999, imageUrl: null, estimatedDeliveryDays: 3, retailerHint: 'spa' },
  { id: 'mock-003', title: 'Luxury Candle Set', description: 'Diptyque-style soy candles, set of 3', priceCents: 6500, imageUrl: null, estimatedDeliveryDays: 3, retailerHint: 'candle' },
  // ... ~20 total
];
```

### Frontend countdown hook [ASSUMED — standard React pattern]

```typescript
function useCancelCountdown(placedAt: string): { secondsLeft: number; canCancel: boolean } {
  const windowMs = 2 * 60 * 60 * 1000;
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const elapsed = Date.now() - new Date(placedAt).getTime();
    return Math.max(0, Math.floor((windowMs - elapsed) / 1000));
  });

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft(s => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  return { secondsLeft, canCancel: secondsLeft > 0 };
}
```

### Voice copy additions needed in voice.ts [VERIFIED: packages/shared/src/copy/voice.ts — partial copy exists]

The existing `voice.ts` has `orderSuccess` and `cancelWindow` keys but is missing:

```typescript
// Additions needed to VOICE constant:
orderCancel: "Order cancelled. No charge. Try a different gift?",
orderFailed: "The order didn't go through. You can try again or order directly.",
orderCancelConfirm: "Cancel this order? The gift won't be delivered.",
orderCancelKeep: "Keep It",
orderCancelConfirmAction: "Yes, Cancel",
orderPlacing: "Placing your order...",
orderPreviewCta: "Confirm & Order",
```

Note: `VOICE.orderSuccess` currently reads "Done. They have no idea how easy that was. Keep it that way." — the CONTEXT.md copy uses "She" but the voice.ts already uses gender-neutral "They". The gender-neutral version from `voice.ts` is correct per Broflo's CLAUDE.md rule ("default they/them unless user specifies relationship context").

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stripe `transfer_data` (deprecated simple) | `destination_payment_method_configuration` | Stripe 2023+ | Destination charges still supported; no migration needed for MVP |
| `stripe.paymentIntents.create` + separate confirm | `confirm: true` in create | Stripe v3+ | One API call for immediate confirm with stored PM |
| `shadcn-ui@latest add` with old CLI | `npx shadcn@latest add` | shadcn 2024 | Sheet/Dialog already installed, no add needed |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Ordering is gated to pro/elite tiers (free users cannot order) | API Endpoints | If free tier should order, remove `@RequiresTier` guard from `/orders/place` |
| A2 | 5% platform fee is the intended take rate for MVP | Stripe Connect Setup | Financial; Kirk should confirm before any real money flows |
| A3 | `GiftRecord.giftRecordId` FK on Order — existing GiftRecord is updated (not replaced) when order is placed | Schema Additions | If new GiftRecord per order is intended, schema changes |
| A4 | `STRIPE_MOCK_RETAILER_ACCOUNT_ID` stored in `cu2-apps-kv` (consistent with all other Broflo secrets) | Stripe Connect Setup | If env var approach used instead, update secret loading pattern |

---

## Open Questions (RESOLVED)

1. **What is the platform fee percentage?** — RESOLVED: 5% confirmed by Kirk (2026-04-11). Store as `STRIPE_PLATFORM_FEE_BPS=500` env var.

2. **Does the free tier ever get to place orders?** — RESOLVED: No. Pro/Elite only, confirmed by Kirk (2026-04-11). Block at `@RequiresTier('pro', 'elite')`.

3. **Is `GiftRecord.source` enum update backward-compatible on production DB?** — RESOLVED: Plan 04 Task 1 handles via raw SQL `ALTER TYPE gift_source ADD VALUE 'ordered'` outside transaction. Standard PostgreSQL pattern, works on Azure PostgreSQL 16.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Stripe SDK | Connect + PaymentIntents | Yes | 22.0.1 | — |
| Prisma | Schema migrations | Yes | 6.0.0 | — |
| shadcn Dialog | Preview modal | Yes | installed | — |
| shadcn Sheet | Mobile order detail | Yes | installed | — |
| shadcn Sonner | Toast notifications | Yes | installed | — |
| Stripe Dashboard access | Register Connect platform | Unknown | — | Cannot proceed without — requires Kirk |
| `cu2-apps-kv` Key Vault | Store STRIPE_MOCK_RETAILER_ACCOUNT_ID | Yes (established) | — | — |

**Missing with no fallback:**
- Stripe Dashboard access to enable Connect and create test connected account — requires Kirk to complete one-time setup before any Stripe Connect code can be exercised in test mode.

---

## Validation Architecture

### Test Framework [VERIFIED: apps/api/package.json — @nestjs/testing installed]

| Property | Value |
|----------|-------|
| Framework | Jest (via NestJS testing module) |
| Config file | apps/api/jest.config.js (inferred — NestJS standard) |
| Quick run command | `cd apps/api && pnpm test -- --testPathPattern=orders` |
| Full suite command | `cd apps/api && pnpm test` |

### Phase Requirements -> Test Map

| Req | Behavior | Test Type | Automated Command |
|-----|----------|-----------|-------------------|
| D-05 | RetailerAdapter interface satisfied by MockAdapter | unit | `pnpm test -- --testPathPattern=mock.adapter` |
| D-07 | MockAdapter 95/5 success/failure rate | unit | `pnpm test -- --testPathPattern=mock.adapter` |
| D-08 | searchProducts filters by keyword + budget | unit | `pnpm test -- --testPathPattern=mock.adapter` |
| D-09 | Cancel returns error after 2h window | unit | `pnpm test -- --testPathPattern=orders.service` |
| D-11 | Stripe refund called on cancel | unit (mock Stripe) | `pnpm test -- --testPathPattern=orders.service` |
| D-06 | PaymentIntent created with transfer_data | integration | manual (requires Stripe test mode) |

### Wave 0 Gaps

- [ ] `apps/api/src/orders/__tests__/mock.adapter.spec.ts` — covers D-05, D-07, D-08
- [ ] `apps/api/src/orders/__tests__/orders.service.spec.ts` — covers D-09, D-11 (mock Stripe + Prisma)

---

## Security Domain

**Tier 3 classification:** This phase touches financial calculations (platform fee), payment intent creation, and charge/refund flows. Per cu2-standards, Kirk sign-off required before any real money flows.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT guard already global; `@CurrentUser()` decorator |
| V3 Session Management | no | — |
| V4 Access Control | yes | `@RequiresTier('pro', 'elite')` on place/cancel |
| V5 Input Validation | yes | NestJS class-validator DTOs on all endpoints |
| V6 Cryptography | no | Stripe handles card data; no local crypto needed |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User A cancels User B's order via direct ID | Tampering | All order queries filter by `userId` — never look up order by ID alone |
| Double-charge via duplicate POST /place | Tampering | Stripe `idempotencyKey` on PaymentIntent create; check Order status before charging |
| Order placed against unowned giftRecord | Elevation | Validate `giftRecord.userId === user.id` before order creation |
| Shipping address injection (XSS via address fields) | Tampering | NestJS `@IsString()` + `@MaxLength()` validators on all address fields |

---

## Project Constraints (from CLAUDE.md)

- **Brand voice:** All UI strings via `packages/shared/src/copy/voice.ts` — no inline text [VERIFIED: Broflo CLAUDE.md]
- **Stripe:** Already activated in S-6; Connect is additive [VERIFIED: billing.service.ts]
- **2-hour cancel window:** Hardcoded in CLAUDE.md as non-negotiable — never remove from default flow [VERIFIED: Broflo CLAUDE.md]
- **Gender language:** Default they/them — existing `voice.ts` `orderSuccess` uses "They" which is correct; CONTEXT.md's "She" example is illustrative only [VERIFIED: Broflo CLAUDE.md + voice.ts]
- **Secrets in `cu2-apps-kv`:** `STRIPE_MOCK_RETAILER_ACCOUNT_ID` must go there [VERIFIED: cu2-standards]
- **Tier 3 classification:** Financial integration — Kirk sign-off required before any real Stripe charges [VERIFIED: cu2-standards Tier system]
- **OPS-Platform:** New OrdersModule is a new feature area — order audit events should route through OPS-Platform (`POST /api/audit/log`) [VERIFIED: cu2-standards — every new service must route audit events]
- **pnpm workspaces:** Use `pnpm` not `npm` [VERIFIED: Broflo CLAUDE.md]
- **TypeScript strict:** `no-explicit-any` enforced [VERIFIED: cu2-standards]

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: apps/api/prisma/schema.prisma] — Current models, GiftSource enum, GiftSuggestion.retailerHint field
- [VERIFIED: apps/api/src/billing/billing.service.ts] — Stripe SDK v22 usage, customer/PM patterns
- [VERIFIED: apps/api/src/billing/billing.controller.ts + guards/] — RequiresTier, CurrentUser decorator patterns
- [VERIFIED: apps/api/src/suggestions/suggestions.service.ts] — selectSuggestion() flow, GiftRecord creation
- [VERIFIED: apps/web/src/components/ui/] — Dialog, Sheet, Sonner, Badge, Skeleton all present
- [VERIFIED: packages/shared/src/copy/voice.ts] — existing voice copy, orderSuccess key, cancelWindow key
- [CITED: docs.stripe.com/connect/destination-charges] — Destination charges with transfer_data.destination + reverse_transfer on refund

### Secondary (MEDIUM confidence)
- [CITED: docs.stripe.com/connect/charges] — Charge type selection rationale (destination vs direct vs separate)
- Stripe SDK v22 `paymentIntents.create` with `confirm: true` — standard single-step pattern for stored payment methods

### Tertiary (LOW confidence)
- None — all critical claims verified against codebase or official docs.

---

## Metadata

**Confidence breakdown:**
- Schema additions: HIGH — verified against current Prisma schema, gap is obvious
- RetailerAdapter pattern: HIGH — established NestJS DI pattern, interface is straightforward
- Stripe Connect: HIGH (pattern) / MEDIUM (specific fee %) — destination charges documented; fee % is assumed
- Cancel window logic: HIGH — pure timestamp arithmetic, no library dependencies
- Frontend patterns: HIGH — all components verified present; countdown hook is standard React

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (Stripe Connect API is stable; NestJS 11 is stable)
