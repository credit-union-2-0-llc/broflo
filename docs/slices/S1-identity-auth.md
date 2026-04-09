# S-1: Identity + Auth

**Phase:** MVP Core
**Estimate:** 1 week
**Depends on:** S-0 (Walking Skeleton)
**Unlocks:** S-2, S-3 (requires a real authenticated user)

---

## Goal

A real user can create an account, log in, and access a protected dashboard. JWT-based session. Email/password auth at minimum, Google OAuth as stretch.

---

## Definition of Done

- [ ] User can sign up with email + password
- [ ] User can log in and receive a JWT
- [ ] Protected routes return 401 without valid JWT
- [ ] `/dashboard` route requires auth — redirects to `/login` if unauthenticated
- [ ] User profile page shows name and email
- [ ] Password stored as bcrypt hash — never plaintext
- [ ] Refresh token rotation implemented
- [ ] "Forgot password" email flow works end-to-end
- [ ] Google OAuth login works (stretch — include if time allows)
- [ ] Prisma `User` model extended with auth fields
- [ ] All auth endpoints covered by integration tests

---

## Tech Tasks

### Database
```
Prisma schema additions:
- User: add password_hash, refresh_token, reset_token, reset_token_expires,
         google_id (nullable), avatar_url (nullable), subscription_tier (default 'free')
- Run migration: 0001_add_auth_fields
```

### API (apps/api)
```
POST /auth/signup        — create user, return JWT + refresh token
POST /auth/login         — validate password, return JWT + refresh token
POST /auth/refresh       — exchange refresh token for new JWT
POST /auth/logout        — invalidate refresh token
POST /auth/forgot        — send reset email
POST /auth/reset         — consume reset token, set new password
GET  /auth/me            — return current user (protected)
GET  /auth/google        — OAuth redirect (stretch)
GET  /auth/google/callback — OAuth callback (stretch)

Middleware:
- JwtAuthGuard (NestJS guard) applied globally, with @Public() decorator for open routes
- Rate limiting on /auth/* endpoints (5 req/min per IP)
```

### Frontend (apps/web)
```
Pages:
- /app/(auth)/login/page.tsx
- /app/(auth)/signup/page.tsx
- /app/(auth)/forgot-password/page.tsx
- /app/(auth)/reset-password/page.tsx
- /app/dashboard/page.tsx (protected stub — shows "Welcome, {name}")
- /app/profile/page.tsx

Components (shadcn/ui based):
- AuthForm — shared form wrapper with Card, CardHeader, CardContent
- Use shadcn Input, Label, Button throughout
- Form validation with react-hook-form + zod
- Toast notifications for errors/success via shadcn Toaster

Auth state:
- NextAuth.js session provider wrapping app layout
- useSession() hook for client-side auth state
- Middleware.ts for server-side route protection
```

### Email
```
- Transactional email: Resend or SendGrid (Key Vault secret)
- Templates: password reset only in this slice
- Plain text fallback required
```

---

## shadcn/ui Components to Add
```
npx shadcn-ui@latest add form
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add separator
```

---

## Acceptance Test

```
1. Navigate to /signup — create account with test@example.com
2. Redirected to /dashboard — sees "Welcome, [name]"
3. Log out
4. Navigate to /dashboard — redirected to /login
5. Log in with test@example.com — back on /dashboard
6. Hit POST /auth/me with expired JWT — 401 returned
7. Use refresh token to get new JWT — 200 returned
8. Trigger "forgot password" — email received with working reset link
9. Reset password, log in with new password — success
```

---

## Notes

- Do not build subscription gating in this slice — that's S-6
- Keep the dashboard stub intentionally minimal — it will be fleshed out in S-3 (Event Radar)
- Google OAuth can slip to S-2 if it's blocking; email/password is the MVP requirement
