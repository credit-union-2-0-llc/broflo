import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Regression guard for Dependabot alert #175 (GHSA-vc2v-76pw-4v95 /
 * CVE-2026-87776): `compression` must resolve to a patched, non-vulnerable
 * version. The advisory covers a Denial of Service via memory leak on
 * premature response close; the first patched release is 1.8.2 (vulnerable
 * range `< 1.8.2`), so that is the security floor enforced here.
 *
 * `compression` is wired into every request in `apps/api/src/main.ts`
 * (`app.use(compression())`), so a regression below the patched version would
 * re-expose the API to the DoS. The durable fix lives in the root
 * `pnpm.overrides` floor (`compression: ">=1.8.2 <2.0.0"`), the bumped
 * `apps/api` dependency range (`^1.8.2`), and the pinned lockfile; this test
 * fails loudly if any of those regress, keeping the fix audit-traceable.
 */
const SECURITY_FLOOR: [number, number, number] = [1, 8, 2];

function findRepoRoot(start: string): string {
  let dir = start;
  // Walk up until we find the workspace lockfile at the repo root.
  while (!existsSync(join(dir, "pnpm-lock.yaml"))) {
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error("Could not locate pnpm-lock.yaml above " + start);
    }
    dir = parent;
  }
  return dir;
}

function parseVersion(version: string): [number, number, number] {
  const [major, minor, patch] = version
    .split(".")
    .map((part) => Number.parseInt(part, 10));
  return [major ?? 0, minor ?? 0, patch ?? 0];
}

function isAtLeast(
  actual: [number, number, number],
  floor: [number, number, number],
): boolean {
  for (let i = 0; i < 3; i += 1) {
    if (actual[i] > floor[i]) return true;
    if (actual[i] < floor[i]) return false;
  }
  return true;
}

describe("compression dependency security floor (Dependabot #175 / GHSA-vc2v-76pw-4v95)", () => {
  const repoRoot = findRepoRoot(__dirname);
  const lockfile = readFileSync(join(repoRoot, "pnpm-lock.yaml"), "utf8");

  it("resolves every compression instance to the patched version (>= 1.8.2)", () => {
    // Matches the core `compression` package entries in the lockfile, e.g.
    //   compression@1.8.2:
    // while deliberately excluding the unrelated `@types/compression` and
    // `compressible` packages.
    const matches = Array.from(
      lockfile.matchAll(/(?:^|\s|')compression@(\d+\.\d+\.\d+)/g),
    );

    expect(matches.length).toBeGreaterThan(0); // sanity: compression is present

    const versions = Array.from(new Set(matches.map((m) => m[1])));
    const vulnerable = versions.filter(
      (v) => !isAtLeast(parseVersion(v), SECURITY_FLOOR),
    );

    expect(vulnerable).toEqual([]);
  });

  it("pins the pnpm override floor at or above the patched version", () => {
    const override = lockfile.match(/^\s*compression:\s*'([^']+)'/m);
    expect(override).not.toBeNull();
    // Floor must not permit anything below 1.8.2.
    expect(override?.[1]).toContain(">=1.8.2");
  });
});
