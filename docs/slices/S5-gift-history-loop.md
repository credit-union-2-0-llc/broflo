# S-5: Gift History Loop

**Phase:** MVP Core
**Estimate:** 0.5 weeks
**Depends on:** S-4 (suggestions must exist to be accepted)
**Unlocks:** S-6 (completes the MVP demo loop)

---

## Goal

Close the core product loop. When a user selects a suggestion or logs a gift manually, it records to gift history and immediately feeds back into the anti-repeat logic. After this slice, the full MVP cycle is demonstrable end-to-end.

---

## Definition of Done

- [ ] User can accept a suggestion → creates a Gift record with status `approved`
- [ ] User can manually log a gift (title, price, retailer, date)
- [ ] Gift history visible on person dossier page
- [ ] Reaction score (1–5 stars) can be added after the fact
- [ ] Anti-repeat logic in S-4 correctly reads from gift history
- [ ] Event status updated to `actioned` when a gift is accepted
- [ ] Gift history shows on person detail: what, when, price, reaction
- [ ] Empty gift history shows Broflo copy: *"Nothing here yet. That's fine. Nobody's judging. (We're judging a little.)"*

---

## Tech Tasks

### API
```
GET  /gifts/person/:personId    — gift history for person
POST /gifts                     — manually log a gift
PATCH /gifts/:id/reaction       — add reaction score (1–5)
```

### Frontend
```
Components:
- GiftHistoryList — timeline view on person dossier page
- GiftHistoryItem — title, date, price, reaction stars, retailer
- ReactionStars — shadcn-style star rating (5 stars)
- AddGiftManuallyDialog — form to log a gift not from suggestions
```

### shadcn/ui Components to Add
```
npx shadcn-ui@latest add table (for history list)
```

---

## MVP Demo Checkpoint

After S-5, the following end-to-end demo is possible:

> Create account → Add Sarah → Add birthday → See event on radar →
> Get AI suggestions → Accept a suggestion → View in gift history →
> Add reaction score

This is the investor/beta demo slice. Do not move to Automation phase until this demo runs clean.

---

## Acceptance Test

```
1. Accept suggestion for Sarah's birthday → Gift record created, status 'approved'
2. Navigate to Sarah's dossier → gift history shows the accepted gift
3. Add reaction score 5 stars → saved, visible in history
4. Re-run gift suggestions for Sarah → accepted gift not suggested again
5. Sarah's birthday event shows status 'actioned'
6. Manually log a second gift → appears in history correctly
```
