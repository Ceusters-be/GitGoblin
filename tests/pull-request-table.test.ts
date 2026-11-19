import { expect, it } from "vitest";
import { compareRequests, creationAge } from "../app/lib/pull-request-table";
import type { PullRequest } from "../app/lib/types";

it("uses local calendar days even across month boundaries", () => {
  const now = new Date(2026, 3, 1, 0, 1);
  expect(creationAge(now.toISOString(), now)).toBe("Today");
  expect(creationAge(new Date(2026, 2, 31, 23, 59).toISOString(), now)).toBe("Yesterday");
  expect(creationAge(new Date(2026, 2, 29).toISOString(), now)).toBe("3 days ago");
});

it("sorts by timestamp or natural title and keeps missing dates last", () => {
  const a = { title: "Fix 2", createdAt: "2026-03-01T10:00:00Z" } as PullRequest;
  const b = { title: "Fix 10", createdAt: "2026-03-01T11:00:00Z" } as PullRequest;
  expect(compareRequests(a, b, "title", true)).toBeLessThan(0);
  expect(compareRequests(a, b, "title", false)).toBeGreaterThan(0);
  expect(compareRequests(a, b, "createdAt", false)).toBeGreaterThan(0);
  for (const ascending of [true, false])
    expect(compareRequests({ ...a, createdAt: null }, b, "createdAt", ascending)).toBeGreaterThan(0);
});
