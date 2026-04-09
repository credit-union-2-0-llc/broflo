# S-3: Event Radar

**Phase:** MVP Core
**Estimate:** 1 week
**Depends on:** S-2 (persons must exist)
**Unlocks:** S-4 (Gift Brain needs an event context)

---

## Goal

Users see all upcoming occasions across all people in a single dashboard view, with intelligent lead-time scoring and email alert delivery. The Event Radar is the product's heartbeat — it's what creates urgency and habit.

---

## Definition of Done

- [ ] Events auto-created from person birthday/anniversary fields
- [ ] User can manually add custom events (graduation, promotion, etc.)
- [ ] Dashboard shows events sorted by urgency (days until event)
- [ ] Lead-time trigger days calculated per event/gift type:
  - Flowers/chocolate: 3 days
  - Standard retail order: 7 days
  - Custom/personalized item: 21 days
  - Experience gift: 14 days
- [ ] Severity scoring: tier 1 (birthday, anniversary), tier 2 (Valentine's, Mother's Day), tier 3 (custom/other)
- [ ] Email alert sent at 30 days, 14 days, 7 days, lead-time day
- [ ] "Snoozed" events don't alert again until next cadence point
- [ ] Upcoming events widget shown on main dashboard
- [ ] Event status: pending → actioned → missed
- [ ] All alert emails use Broflo brand voice

---

## Tech Tasks

### Database
```
Prisma schema additions:
- Event model (see README data model)
- EventAlert: id, event_id, user_id, alert_type (30d|14d|7d|lead),
              scheduled_at, sent_at, status
- Run migration: 0003_add_events
```

### API
```
GET  /events              — all upcoming events for user (sorted by date)
POST /events              — create custom event
GET  /events/:id          — event detail
PATCH /events/:id         — update (status, snooze)
DELETE /events/:id        — delete custom event (auto-events cannot be deleted)

Background jobs (cron):
- generateEventsFromPersons  — runs nightly, creates/updates recurring events
- scheduleAlerts             — runs hourly, queues due alerts
- sendDueAlerts              — runs every 15min, processes alert queue
```

### Frontend
```
Pages:
- /app/dashboard/page.tsx    — main dashboard (replaces stub from S-1)
  - "Radar" section: upcoming events in urgency order
  - Color-coded urgency: red (<7d), amber (7–14d), green (>14d)
  - Each event card: person name, event type, days away, severity badge
  - CTA: "Find a gift" → links to S-4 gift suggestions

Components:
- EventRadar — main dashboard widget (shadcn Card)
- EventCard — urgency color, person avatar, countdown chip
- UrgencyBadge — "3 days" chip with color variant
- AddEventDialog — shadcn Dialog with event form
```

### shadcn/ui Components to Add
```
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add calendar
npx shadcn-ui@latest add popover
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add scroll-area
```

### Email Templates
```
- 30-day alert: "Heads up: {name}'s {event} is in 30 days. Plenty of time. For now."
- 14-day alert: "Two weeks. Clock's ticking. {name}'s {event} needs your attention."
- 7-day alert: "One week. We're not panicking. You should probably be panicking."
- Lead-time alert: "Last call. {name}'s {event} is in {n} days. Order. Now."
- Missed event: "You missed {name}'s {event}. The Groveling Package is standing by."
```

---

## Acceptance Test

```
1. Create person with birthday 30 days from today
2. Dashboard shows event with green urgency badge, "30 days" countdown
3. Manually trigger 30-day alert job — email received with correct copy
4. Advance mock date to T-7 — event shows red urgency badge
5. Create custom event "Sarah's promotion" for next week
6. Snooze event — alert suppressed until next cadence point
7. Mark event as "actioned" — moves out of active radar view
8. Person with no upcoming events shows correctly in list
```

---

## Notes

- Recurring event generation (birthdays repeat annually) must handle year rollover correctly
- Time zones: store all dates as UTC, display in user's browser timezone
- Do not build in-app notifications here — that's S-14 (PWA push). Email only in this slice.
- The "Find a gift" CTA on event cards can be a stub link until S-4 ships
