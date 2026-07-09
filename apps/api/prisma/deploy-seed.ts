// Runs automatically on every API deploy, right after `prisma migrate deploy`
// (see .github/workflows/ci.yml). Only seedPlans() — it's a pure upsert by
// Plan.key / PlanLimit's (planId, featureKey) unique constraint, so it's
// safe to run unconditionally on every deploy, the same way migrations are.
//
// Deliberately does NOT run seedAdminsFromEnv() or the retailer-profile
// seed from seed.ts's full main() — those aren't idempotent-safe-by-default
// in the same "just always re-apply the source of truth" sense (admin
// status, once DB-backed, shouldn't be silently re-derived from an env var
// on every deploy) and are still run manually via `prisma db seed` when
// actually needed.
import { prisma, seedPlans } from './seed';

seedPlans()
  .then(() => console.log('Plan seed applied.'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
