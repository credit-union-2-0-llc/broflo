---
phase: 07
slug: first-retailer-api
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (via @nestjs/testing) |
| **Config file** | apps/api/jest.config.js |
| **Quick run command** | `cd apps/api && pnpm test -- --testPathPattern=orders` |
| **Full suite command** | `cd apps/api && pnpm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && pnpm test -- --testPathPattern=orders`
- **After every plan wave:** Run `cd apps/api && pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-03 | 01 | 1 | D-05, D-07, D-08 | unit | `pnpm test -- --testPathPattern=mock.adapter` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | D-09, D-11 | unit | `pnpm test -- --testPathPattern=orders.service` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 2 | D-06, D-12 | integration | manual (Stripe test mode) | N/A | ⬜ pending |
| 07-04-04 | 04 | 3 | all | e2e | manual checkpoint | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/orders/__tests__/mock.adapter.spec.ts` — stubs for D-05, D-07, D-08
- [ ] `apps/api/src/orders/__tests__/orders.service.spec.ts` — stubs for D-09, D-11 (mock Stripe + Prisma)
