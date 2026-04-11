# Broflo — Roadmap

## Milestone: MVP Launch

### Completed Phases
| Phase | Name | Status |
|-------|------|--------|
| S-0 | Walking Skeleton | Complete |
| S-1 | Identity + Auth | Complete |
| S-2 | Person Dossier | Complete |
| S-2.5 | Security Hardening | Complete |
| S-3 | Event Radar | Complete |
| S-4 | Gift Brain MVP | Complete |
| S-5 | Gift History Loop | Complete |
| G4 | Security Fixes | Complete |
| S-6 | Stripe Payment Vault | Complete |

### Phase 7: First Retailer API

**Goal:** Place real orders at retailers on user's behalf via Stripe Connect. One-tap approve flow with 2-hour cancel window. Mock adapter until retailer credentials secured.

**Status:** Planning complete

**Depends on:** S-6 (payment vault required), S-4 (suggestions required)

**Plans:** 4 plans

Plans:
- [ ] 07-01-PLAN.md — OrdersModule backend: schema, RetailerAdapter, MockAdapter, API endpoints, unit tests
- [ ] 07-02-PLAN.md — Stripe Connect integration: destination charges, refunds with reverse_transfer
- [ ] 07-03-PLAN.md — Frontend order flow: preview modal, cancel countdown, cancel dialog, suggestion card updates
- [ ] 07-04-PLAN.md — Integration: DB schema push, SuggestionsView wiring, e2e verification checkpoint

**Canonical refs:**
- `docs/slices/S7-first-retailer-api.md`

### Future Phases
| Phase | Name |
|-------|------|
| S-8/S-9 | Order Tracking + Autopilot |
| S-10/S-11/S-12 | Intelligence |
| S-13/S-16 | Growth |
