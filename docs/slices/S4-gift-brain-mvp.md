# S-4: Gift Brain MVP

**Phase:** MVP Core
**Estimate:** 1.5 weeks
**Depends on:** S-2 (dossier), S-3 (event context)
**Unlocks:** S-5 (gift history), S-7 (auto-execute needs suggestions first)

---

## Goal

The AI produces 3–5 ranked, thoughtful gift suggestions for a person + event combination. Each suggestion has a rationale, estimated price, delight score, and novelty score. This is the core value-delivery moment of the product.

---

## Definition of Done

- [ ] User can request suggestions for any person + event
- [ ] AI returns 3–5 ranked suggestions within 10 seconds
- [ ] Each suggestion includes: title, description, rationale, estimated price range, delight score (1–10), novelty score (1–10), suggested retailer
- [ ] Suggestions respect budget range from dossier
- [ ] Anti-repeat logic: suggestions never include items in gift history
- [ ] "Never again" list items excluded from suggestions
- [ ] "Surprise factor" toggle: safe vs. bold
- [ ] Suggestions persisted to `GiftSuggestion` table
- [ ] User can dismiss a suggestion (won't show again for this event)
- [ ] Loading state with Broflo voice copy while AI thinks
- [ ] AI model version logged with each suggestion (for future regression testing)

---

## Tech Tasks

### AI Service (services/ai)
```
POST /suggest

Request:
{
  person: { name, relationship, preferences, sizes, music, brands, hobbies, food, notes },
  event: { type, date, days_until },
  budget: { min, max },
  gift_history: [{ title, date, reaction_score }],
  never_again: [string],
  surprise_factor: 'safe' | 'bold',
  count: 3 | 5
}

Response:
{
  suggestions: [
    {
      rank: 1,
      title: string,
      description: string,
      rationale: string,
      estimated_price_min: number,
      estimated_price_max: number,
      delight_score: number,
      novelty_score: number,
      suggested_retailer: string,
      search_keywords: string[]
    }
  ],
  model_version: string
}
```

### Prompt Engineering
```
System prompt (stored in /services/ai/prompts/gift-suggest.txt):

You are Broflo's Gift Brain — a brilliant, discreet gift concierge with the taste level of 
a thoughtful friend who happens to know everything about the recipient. You are NOT a generic 
gift list generator. Every suggestion must feel personal, specific, and considered.

Rules:
1. Never suggest anything on the never_again list
2. Never repeat from gift_history (exact or very similar items)
3. Stay within the budget range — estimated_price must be realistic
4. Rank by (delight_score * 0.6) + (novelty_score * 0.4)
5. For 'bold' surprise_factor: prioritize novelty_score
6. For 'safe' surprise_factor: prioritize delight_score
7. Rationale must reference specific details from the person's dossier
8. Return ONLY valid JSON matching the response schema — no prose, no markdown

Output JSON schema: [schema here]
```

### API Bridge (apps/api)
```
POST /suggestions/generate   — proxies to AI service, persists results
GET  /suggestions/event/:id  — get suggestions for event
PATCH /suggestions/:id/dismiss
```

### Frontend
```
Pages:
- /app/people/[id]/events/[eventId]/suggest/page.tsx

Components:
- SuggestionRequest — person summary + event + surprise factor toggle + "Find Gifts" button
- SuggestionLoading — skeleton with rotating Broflo voice lines:
    "Consulting the gift oracle..."
    "Cross-referencing vibes..."
    "Calculating delight coefficient..."
- SuggestionCard:
    - Title + description
    - Rationale (expandable)
    - Price range badge
    - Delight + Novelty score bars (shadcn Progress)
    - Retailer name
    - Actions: "I'll order this" | "Not quite" (dismiss)
- SurpriseToggle — shadcn Switch: Safe / Bold
```

### shadcn/ui Components to Add
```
npx shadcn-ui@latest add progress
npx shadcn-ui@latest add switch
npx shadcn-ui@latest add skeleton
npx shadcn-ui@latest add collapsible
```

---

## Prompt Testing Protocol

Before shipping S-4, run the following test matrix against the AI service:

| Scenario | Person Type | Budget | History | Expected |
|---|---|---|---|---|
| Basic | Partner, birthday | $50–$100 | Empty | 5 varied suggestions |
| Anti-repeat | Partner, birthday | $50–$100 | 3 prior gifts | None repeated |
| Tight budget | Friend, birthday | $20–$30 | Empty | All under $30 |
| Bold mode | Partner, anniversary | $100–$200 | Empty | Higher novelty scores |
| Safe mode | Parent, birthday | $50–$75 | Empty | Higher delight scores |
| Never again | Partner, birthday | $50–$150 | Never: "candles" | No candle suggestions |

---

## Acceptance Test

```
1. Navigate to Sarah's event → "Find Gifts"
2. Loading state shows rotating Broflo copy for ~5 seconds
3. 5 suggestions appear, each with title, rationale, price range, scores
4. All prices within Sarah's $75–$200 budget
5. Toggle to "Bold" — suggestions visibly different, higher novelty
6. Dismiss top suggestion — disappears, doesn't return on refresh
7. Order confirmation stub: click "I'll order this" — logs to gift history (S-5)
8. Re-run suggestions — dismissed item does not reappear
9. Run with prior gift in history — prior gift not suggested
```

---

## Notes

- AI response time target: <8 seconds p95. Log all latency.
- If AI service is unavailable, return a graceful error with Broflo voice copy: *"The gift oracle is temporarily offline. Even we have bad days."*
- Stream the response if latency exceeds 8 seconds — show suggestions as they arrive rather than waiting for the full batch
- The `search_keywords` field is forward-looking — S-7 will use these to query retailer APIs
