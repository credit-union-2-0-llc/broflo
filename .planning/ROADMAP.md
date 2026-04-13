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
| S-8 | Order Tracking | Complete |
| S-9 | Autopilot | Complete |
| S-10 | Browser Agent Fallback | Complete |
| S-11 | Enrichment (Wishlists, Tags, Insights) | Complete |
| S-12 | Photo Dossier Enrichment | Complete |

### Future Phases
| Phase | Name | Notes |
|-------|------|-------|
| S-13+ | Growth | Referrals, onboarding, analytics, marketing — not yet specced |

### Known Issues (2026-04-13)
- Deploy AI job fails — `broflo-cicd` SP scoped to `rg-broflo`, can't reach `cu2registry` in `rg-cu2-shared`
- Intermittent 401s on notification polling — JWT refresh race condition during 15m token rotation window (self-corrects)
