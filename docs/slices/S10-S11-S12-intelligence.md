# S-10: Browser Agent Fallback

**Phase:** Intelligence
**Estimate:** 1.5 weeks
**Depends on:** S-9 (autopilot architecture in place)
**Unlocks:** Long-tail retailer coverage — any site on the internet

---

## Goal

When a gift suggestion points to a retailer without a direct API integration, Broflo's browser agent executes the purchase automatically. The user experience is identical to a native API order. The implementation is a managed browser session purchasing on behalf of the user.

---

## Definition of Done

- [ ] Browser agent service integrated (Steel.dev or Browserbase)
- [ ] Agent can purchase from at least 3 non-integrated retailers (Nordstrom, Williams Sonoma, and one specialty site)
- [ ] Agent uses Broflo's retailer accounts + user's stored payment method
- [ ] Agent purchasing triggers same order confirmation and tracking flow as API orders
- [ ] Failed agent purchase (site layout change, CAPTCHA, OOS) → graceful fallback to manual CTA
- [ ] CAPTCHA detected → immediately stops, notifies user, never attempts bypass
- [ ] Agent sessions are isolated (no cross-user cookie leakage)
- [ ] All agent actions logged: screenshots at key steps, actions taken, outcome
- [ ] P95 execution time < 3 minutes per order

---

## Tech Tasks

### Browser Agent Service (services/browser-agent)
```
New FastAPI service using Steel.dev or Browserbase SDK

BrowserOrderAgent:
  execute(retailer_url, product_search_terms, budget, recipient_address): AgentResult

Steps the agent takes:
1. Navigate to retailer
2. Search for product using search_keywords from S-4 AI suggestion
3. Filter by price range
4. Select best matching product
5. Add to cart
6. Enter recipient shipping address
7. Apply payment (Broflo stored payment method)
8. Confirm order
9. Capture order confirmation number
10. Return AgentResult { success, order_id, product_title, price, screenshot_url }

CAPTCHA policy: if detected at any step → abort, return { success: false, reason: 'captcha' }
```

### Retailer Account Strategy
```
Broflo maintains its own accounts at major non-integrated retailers:
- These are Broflo service accounts (not user accounts)
- Orders placed as "gift orders" to recipient addresses
- Payment via Broflo's stored card (user charged separately via Stripe)
- Required accounts to create before S-10 ships:
    - Nordstrom
    - Williams-Sonoma / Pottery Barn
    - Uncommon Goods
    - Zola (registry support)
```

### API Bridge
```
POST /orders/agent/preview    — returns agent's found product + price before placing
POST /orders/agent/place      — triggers agent execution (async, webhook result)
GET  /orders/agent/:jobId     — poll agent job status
```

---

## Acceptance Test

```
1. Add suggestion with Nordstrom as suggested retailer
2. Click "Order This" → OrderPreviewModal uses agent to find product + price
3. Confirm → agent execution starts (async)
4. Status shows "Broflo is handling it..."
5. Agent completes → order confirmation stored, tracking number available
6. Test CAPTCHA trigger → order aborted, user notified with manual link
7. Test OOS product → graceful failure, alternative suggestion offered
8. Check agent logs → screenshots at each step captured
```

---

## Notes

- Do not attempt to bypass CAPTCHA — ever. This is a hard stop.
- Some sites detect headless browsers and block them. If a retailer blocks more than 30% of agent attempts, remove it from the supported list.
- This slice is marked as medium-high risk — if Steel.dev/Browserbase latency or reliability is poor, the fallback is manual order links only. Don't let this slice block S-11.

---
---

# S-11: Dossier Enrichment

**Phase:** Intelligence
**Estimate:** 1.5 weeks
**Depends on:** S-2 (dossier exists), S-4 (AI service exists)
**Unlocks:** Better gift suggestions immediately

---

## Goal

When a user provides a Pinterest board URL, Amazon wishlist, or similar link, the AI parses it and auto-populates the person's dossier with inferred preferences. This makes onboarding magical — paste a URL and watch the dossier fill itself.

---

## Definition of Done

- [ ] User can paste a URL into a person's dossier (Pinterest, Amazon wishlist, public Instagram, any product page)
- [ ] AI service fetches and parses the URL content
- [ ] Extracted preferences shown to user for review before saving (never auto-save without review)
- [ ] Accepted preferences merge into dossier without overwriting existing fields
- [ ] Rejected items discarded
- [ ] Supported sources: Pinterest boards, Amazon wishlists, public wedding/gift registries, product page URLs
- [ ] Unsupported/private URL: graceful error with Broflo copy
- [ ] Parsing works on at least 3 URL types in acceptance testing

---

## Tech Tasks

### AI Enrichment Endpoint (services/ai)
```
POST /enrich

Request: { url: string, person_context: PersonSummary }

Process:
1. Fetch URL content (Playwright headless for JS-rendered pages)
2. Extract: product names, categories, price ranges, brands, styles, colors
3. Infer: clothing preferences, aesthetic style, hobbies, interests
4. Return structured EnrichmentResult

Response:
{
  source_url: string,
  extracted_items: [{ title, category, price, brand, confidence }],
  inferred_preferences: {
    brands: string[],
    style_keywords: string[],
    price_comfort_zone: { min, max },
    categories: string[],
    notes: string
  },
  confidence_score: number
}
```

### Frontend
```
Components:
- EnrichmentURLInput — input field on dossier with "Analyze" button
  Broflo copy: "Drop a Pinterest board, wishlist, or any product page.
  We'll figure out what they like."
- EnrichmentReviewPanel — show extracted preferences as checkboxes
  "We found these. Keep what's useful."
  Each item: toggle on/off before saving
- EnrichmentLoading — "Interrogating their Pinterest..."
```

---

## Acceptance Test

```
1. Open Sarah's dossier → paste a public Pinterest board URL
2. Loading: "Interrogating their Pinterest..."
3. Review panel shows 8–12 extracted preferences (brands, styles, categories)
4. Uncheck 2 irrelevant items
5. Click "Save to Dossier" → checked items merge into preferences
6. Navigate to gift suggestions — new suggestions reflect enriched dossier
7. Paste private Instagram URL → "This profile is private. Ask them to share a wishlist instead."
8. Paste Amazon wishlist → product categories and price ranges extracted correctly
```

---

## Notes

- Never scrape social platforms in violation of their ToS. Pinterest allows embedding/API access; use their official API where possible. Amazon wishlists are publicly accessible by design.
- The enrichment result must always go through a user review step — no silent dossier modifications
- Confidence score < 0.4: show warning "We're not very confident about these. Review carefully."

---
---

# S-12: Voice Layer

**Phase:** Intelligence
**Estimate:** 0.5 weeks
**Depends on:** All prior slices (this is a polish pass on existing copy)
**Unlocks:** Nothing technically — but makes the whole product feel alive

---

## Goal

Every empty state, loading state, error, notification, and confirmation in the product has Broflo voice copy. This slice is a dedicated pass through the entire UI to replace generic copy with brand voice. It takes half a week and makes the product feel 3x more finished.

---

## Definition of Done

- [ ] All empty states replaced with Broflo voice copy
- [ ] All loading states have rotating Broflo voice lines
- [ ] All error states have Broflo voice copy + human next step
- [ ] All success toasts have Broflo voice copy
- [ ] All email subjects and preview text use brand voice
- [ ] All onboarding prompts use brand voice
- [ ] Copy reviewed against voice guide: never frat-bro, never saccharine, always slightly self-aware
- [ ] Gender-neutral by default (they/them) unless user has specified relationship context

---

## Voice Copy Inventory

### Empty States
```
/people (no people yet):
  "Nobody here yet. Add someone before their birthday sneaks up on you."

/people/:id/gifts (no gift history):
  "Nothing here yet. That's fine. Nobody's judging. (We're judging a little.)"

/dashboard (no upcoming events):
  "All quiet. Either everyone's birthdays are far away, or you haven't added anyone yet.
  Our money's on the second one."

Suggestions (first time, no history context):
  "We're going in cold — no history yet. These suggestions are based on vibes.
  Add reaction scores after to sharpen future picks."
```

### Loading States (rotate randomly)
```
Gift Brain loading:
  "Consulting the gift oracle..."
  "Cross-referencing their vibes..."
  "Calculating delight coefficient..."
  "Googling what a 'vibe' is..."
  "Pretending to be thoughtful..."

Agent order loading:
  "Broflo is handling it. Relax."
  "We're placing the order. Hands off."
  "Working on it. This is what you pay us for."
```

### Success States
```
Order placed:
  "Done. She has no idea how easy that was. Keep it that way."

Event actioned:
  "Handled. Next."

Dossier saved:
  "Noted. We'll use this."

Subscription upgraded:
  "Welcome to Pro. You are now a better gift-giver. Statistically."
```

### Error States
```
Order failed:
  "The order didn't go through. It happens. Try again or order manually — we won't judge."

AI service down:
  "The gift oracle is temporarily offline. Even we have bad days."

Payment failed:
  "The card didn't cooperate. Update your payment method and we'll get back to it."
```

### Missed Event
```
"You missed {name}'s {event}. It's fine. No it isn't.
  The Groveling Package is standing by whenever you're ready."
```

---

## Tech Tasks

```
- Create /packages/shared/copy/voice.ts — centralized copy constants
- Audit every page and component for generic copy
- Replace with voice.ts references (no inline strings)
- Create RotatingCopy component: takes array of strings, rotates on interval
- Update all email templates
- Document voice guide additions in /docs/brand-voice.md
```

---

## Notes

- This slice is easy to underestimate. A full audit of a 16-screen product takes more than a day.
- If the voice copy feels forced anywhere, it's better to go neutral than to be try-hard. The best Broflo copy is copy that makes the user smile once and then gets out of the way.
- After this slice, the Intelligence phase is complete. The product is now ready for Growth phase features.
