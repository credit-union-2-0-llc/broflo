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
| S-7 | First Retailer API | Complete |

### Phase 8: Order Tracking

**Goal:** Post-placement order lifecycle — status timeline, tracking info, webhook receiver, polling cron, orders list/detail UI, dashboard widget.

**Status:** Planning complete

**Depends on:** S-7 (orders module), S-6 (payment vault)

**Plans:** 3 plans

Plans:
- [ ] 08-01-PLAN.md — Schema + OrderStatusHistory + MockAdapter update (delivered enum, tracking fields, history model)
- [ ] 08-02-PLAN.md — Backend: timeline endpoint, webhook receiver, polling cron, status transitions, enhanced list
- [ ] 08-03-PLAN.md — Frontend: /orders list, /orders/:id detail with timeline, tracking card, dashboard widget, nav update

**Canonical refs:**
- Agent artifacts at `cu2-agent-studio/projects/broflo/artifacts/*-s8s9-2026-04-12.md`

### Phase 9: Autopilot

**Goal:** Auto-gifting for recurring events. Per-person opt-in, AI picks gift, auto-orders with cancel window notification. Pro+ only.

**Status:** Planned (blocked by S-8)

**Depends on:** S-8 (order tracking), S-4 (AI suggestions), S-5 (gift history)

### Future Phases
| Phase | Name |
|-------|------|
| S-10/S-11/S-12 | Intelligence |
| S-13/S-16 | Growth |
