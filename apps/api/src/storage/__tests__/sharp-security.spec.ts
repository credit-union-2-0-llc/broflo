import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Regression guard for Dependabot alert #178 (GHSA-wq5f-xc86-pv6w) and
 * alert #152 (GHSA-rgj7-g3m4-5g8c): `sharp` must resolve to a patched,
 * non-vulnerable version. The first patched release for #178 is 0.35.5
 * (vulnerable range `< 0.35.5`), so that is the security floor enforced here.
 *
 * The real durable fix lives in the root `pnpm.overrides` floor
 * (`sharp: ">=0.35.5 <1.0.0"`) plus the pinned lockfile; this test fails loudly
 * if either regresses below the patched version, keeping the fix audit-traceable.
 */
const SECURITY_FLOOR: [number, number, number] = [0, 35, 5];

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

describe("sharp dependency security floor (Dependabot #178 / GHSA-wq5f-xc86-pv6w)", () => {
  const repoRoot = findRepoRoot(__dirname);
  const lockfile = readFileSync(join(repoRoot, "pnpm-lock.yaml"), "utf8");

  it("resolves every sharp instance to the patched version (>= 0.35.5)", () => {
    // Matches the core `sharp` package entries in the lockfile, e.g.
    //   sharp@0.35.5:
    //   sharp@0.35.5(@types/node@20.19.39):
    const matches = Array.from(
      lockfile.matchAll(/(?:^|\s|')sharp@(\d+\.\d+\.\d+)/g),
    );

    expect(matches.length).toBeGreaterThan(0); // sanity: sharp is actually present

    const versions = Array.from(new Set(matches.map((m) => m[1])));
    const vulnerable = versions.filter(
      (v) => !isAtLeast(parseVersion(v), SECURITY_FLOOR),
    );

    expect(vulnerable).toEqual([]);
  });

  it("pins the pnpm override floor at or above the patched version", () => {
    const override = lockfile.match(/^\s*sharp:\s*'([^']+)'/m);
    expect(override).not.toBeNull();
    // Floor must not permit anything below 0.35.5.
    expect(override?.[1]).toContain(">=0.35.5");
  });
});
