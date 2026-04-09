# S-2: Person Dossier

**Phase:** MVP Core
**Estimate:** 1.5 weeks
**Depends on:** S-1 (authenticated user required)
**Unlocks:** S-3, S-4

---

## Goal

A user can create, view, edit, and delete people in their life. Each person has a rich dossier — relationship type, key preferences, sizes, budget range. This is the core data object that everything else hangs on.

---

## Definition of Done

- [ ] User can create a person with name, relationship type, birthday, budget min/max
- [ ] Extended dossier fields: clothing sizes, music taste, favorite brands, hobbies, food preferences, notes
- [ ] Person list page shows all people with upcoming event count
- [ ] Person detail page shows full dossier
- [ ] Edit and delete work end-to-end
- [ ] Budget range stored as integers (cents) — displayed as dollars
- [ ] Relationship types: partner, spouse, parent, sibling, child, friend, coworker, boss, other
- [ ] "Never again" list: user can flag gift ideas to exclude
- [ ] Wishlist URLs field: free-text URLs the AI will parse later (S-11)
- [ ] All CRUD endpoints covered by tests
- [ ] Empty state has Broflo voice copy

---

## Tech Tasks

### Database
```
Prisma schema additions:
- Person model (see README data model)
- Never_again_item: id, person_id, description, created_at
- Run migration: 0002_add_persons
```

### API
```
GET    /persons              — list all for current user
POST   /persons              — create
GET    /persons/:id          — get dossier
PATCH  /persons/:id          — update
DELETE /persons/:id          — soft delete (deleted_at timestamp)
POST   /persons/:id/never-again     — add to never-again list
DELETE /persons/:id/never-again/:itemId
```

### Frontend
```
Pages:
- /app/people/page.tsx              — person list (cards grid)
- /app/people/new/page.tsx          — create form
- /app/people/[id]/page.tsx         — dossier detail view
- /app/people/[id]/edit/page.tsx    — edit form

Components:
- PersonCard — avatar initials, name, relationship badge, next event chip
- DossierForm — multi-section form with shadcn Tabs for sections:
    Tab 1: Basic (name, relationship, birthday, anniversary)
    Tab 2: Budget (min/max range slider)
    Tab 3: Preferences (sizes, music, brands, hobbies, food)
    Tab 4: Notes + Wishlist URLs + Never Again list
- RelationshipBadge — shadcn Badge variant per relationship type
- BudgetRangeInput — dual-handle slider using shadcn Slider
```

## shadcn/ui Components to Add
```
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add slider
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add select
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add alert-dialog
```

---

## Acceptance Test

```
1. Navigate to /people — empty state with Broflo voice copy
2. Create person: "Sarah", Partner, birthday Jan 15, budget $50–$150
3. Add preferences: size M, likes indie music, loves Thai food
4. Add "never again": "generic candle"
5. See Sarah on person list with relationship badge
6. Edit Sarah's budget to $75–$200 — saved correctly
7. Soft delete Sarah — no longer appears in list
8. Confirm DELETE /persons/:id returns 404 for deleted record
```

---

## Notes

- Avatar is initials-only in this slice — photo upload is a post-launch feature
- Wishlist URL field is collect-only here; AI parsing happens in S-11
- Keep dossier form sections collapsed by default — the full form is overwhelming on first view
