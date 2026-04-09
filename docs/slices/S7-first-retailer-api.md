# S-7: First Retailer API

**Phase:** Automation
**Estimate:** 1.5 weeks
**Depends on:** S-6 (payment vault required), S-4 (suggestions required)
**Unlocks:** S-8 (tracking), S-9 (autopilot)

---

## Goal

Broflo places a real order at a real retailer on the user's behalf using their stored payment method. One-tap approve flow. This is the highest-risk slice in the project — budget extra time and test with real purchases early.

**First retailer target: 1-800-Flowers** (most common gift category, reliable API, low order complexity)
**Second target: Amazon** (catch-all fallback for anything)

---

## Definition of Done

- [ ] User can click "Order This" on a suggestion and see order details before confirming
- [ ] Order confirmation modal shows: item, retailer, price, estimated delivery date, cancel window
- [ ] User approves → order placed via retailer API using stored Stripe payment method
- [ ] Order ID and tracking info stored on Gift record
- [ ] Gift status updates: `approved` → `ordered` → (tracking in S-8)
- [ ] 2-hour cancel window: order can be cancelled within 2 hours of placement
- [ ] Cancellation handled via retailer API if within window, Broflo-side flag if outside
- [ ] Full audit log: what was ordered, from where, amount charged, timestamp
- [ ] Failed order surfaced gracefully with Broflo voice copy + manual fallback CTA
- [ ] Test order successfully placed and received by real address before shipping

---

## Tech Tasks

### Retailer Integration Service (services/commerce)
```
New FastAPI service or NestJS module: commerce

Interface: RetailerAdapter
  searchProducts(keywords, budgetMin, budgetMax): Product[]
  getProduct(productId): Product
  placeOrder(product, shippingAddress, paymentToken): OrderResult
  cancelOrder(orderId): CancelResult
  getOrderStatus(orderId): OrderStatus

Implementations:
  FlowersAdapter (1-800-Flowers API)
  AmazonAdapter  (Amazon Product Advertising API + Buy API)
```

### 1-800-Flowers Integration
```
- API credentials stored in cu2-apps-kv
- Product search by keyword + price range
- Order placement with:
    - Recipient name + address
    - Delivery date selection (next available)
    - Payment via tokenized card (Stripe → retailer payment token)
- Webhook/polling for order confirmation
- Error handling: OOS item → auto-suggest replacement from same search
```

### Payment Flow
```
Broflo NEVER sends raw card numbers to retailers.

Flow:
1. User has stripe_payment_method_id stored from S-6
2. On order: Stripe creates a payment intent for the retailer amount
3. Retailer receives payment via Stripe Connect or direct charge
4. Alternatively: Broflo charges user via Stripe, then pays retailer via
   Broflo's own payment method (simpler, but requires Broflo to hold funds)

Recommended approach for MVP: Option B (simpler)
- Charge user's stored card via Stripe
- Fulfill order via Broflo's retailer account
- Log the transaction with full audit trail
```

### API (apps/api)
```
POST /orders/preview          — get order preview (item + price + delivery estimate)
POST /orders/place            — place order (requires user approval via request body)
POST /orders/:id/cancel       — cancel if within 2-hour window
GET  /orders                  — order history for user
GET  /orders/:id              — order detail
```

### Frontend
```
Components:
- OrderPreviewModal (shadcn Dialog):
    - Product image (if available) + title + description
    - Price (from retailer API, may differ from AI estimate)
    - Estimated delivery date
    - Delivery address (user's default or custom entry)
    - "Confirm & Order" button
    - "2-hour cancel window" disclosure
    - Cancel / Back button
- OrderConfirmationToast — Broflo voice: "Done. She has no idea how easy that was."
- OrderCancelButton — visible on gift detail if within cancel window (countdown timer)
- OrderFailureAlert — "The order didn't go through. You can try again or order manually."
  with link to retailer site
```

### shadcn/ui Components to Add
```
npx shadcn-ui@latest add sheet (for mobile order detail)
```

---

## Pre-Ship Checklist (HIGH RISK SLICE)

Before marking done:
- [ ] Test order placed successfully via 1-800-Flowers API in sandbox
- [ ] Test order placed with real address in production API (test flower delivery)
- [ ] Cancellation tested: cancel within 2 hours → order cancelled at retailer
- [ ] Failed payment tested: card decline → graceful error shown
- [ ] OOS product tested: replacement suggestion flow works
- [ ] Audit log verified: every order attempt logged regardless of outcome

---

## Acceptance Test

```
1. Navigate to Sarah's suggestion → click "Order This"
2. OrderPreviewModal shows: item, $XX.XX, delivery by [date], address
3. Click "Confirm & Order"
4. Loading state: "Placing your order..."
5. Success toast: "Done. She has no idea how easy that was. Keep it that way."
6. Gift status shows "ordered" with order ID
7. Within 2-hour window: cancel button visible with countdown
8. Click cancel → order cancelled, status returns to 'approved', toast confirms
9. Simulate API failure → error state shown, manual order link offered
10. Check audit log: both successful and failed attempts logged
```

---

## Notes

- This slice requires a real credit card and real order in production testing. Budget ~$50 for test flowers.
- Amazon Buy API access requires a separate application process — start it before S-7 begins
- If 1-800-Flowers API access is delayed, substitute with a simpler retailer (Teleflora has a more accessible API)
- The payment architecture decision (Option A vs B above) must be made before development starts
