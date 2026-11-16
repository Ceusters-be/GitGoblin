import { expect, it, vi } from "vitest";
import { createDiffCache } from "../app/lib/diff-cache";

it('does not let a limited prefetch reject or overwrite a foreground read', async () => {
  const cache = createDiffCache();
  let reject!: (error: Error) => void;
  const prefetch = cache.load('file', () => new Promise((_, fail) => { reject = fail; }), true);
  const rejection = expect(prefetch).rejects.toThrow('limit');
  const foreground = cache.load('file', async () => ({ text: 'full', fingerprint: 'full' }));
  reject(new Error('limit'));
  await rejection;
  expect((await foreground).text).toBe('full');
  expect(cache.get('file')?.text).toBe('full');
});

it('invalidates selected files and prevents their pending reads from restoring old content', async () => {
  const cache = createDiffCache();
  await cache.load('keep', async () => ({ text: 'keep', fingerprint: 'keep' }));
  let finish!: (value: { text: string; fingerprint: string }) => void;
  const old = cache.load('changed', () => new Promise(resolve => { finish = resolve; }));
  cache.invalidate(key => key === 'changed');
  finish({ text: 'old', fingerprint: 'old' });
  await old;
  expect(cache.get('changed')).toBeUndefined();
  expect(cache.get('keep')?.text).toBe('keep');
});

it("shares in-flight reads and makes previously viewed diffs immediately available", async () => {
  const cache = createDiffCache();
  let resolve!: (value: { text: string; fingerprint: string }) => void;
  const read = vi.fn(() => new Promise<{ text: string; fingerprint: string }>((done) => { resolve = done; }));
  const first = cache.load("repo/working/file", read);
  expect(cache.load("repo/working/file", read)).toBe(first);
  expect(read).toHaveBeenCalledTimes(1);
  const diff = { text: "+one", fingerprint: "first" };
  resolve(diff);
  await first;
  expect(cache.get("repo/working/file")).toBe(diff);
  expect(cache.get("repo/staged/file")).toBeUndefined();
});

it("does not restore invalidated entries from requests finishing after a mutation", async () => {
  const cache = createDiffCache();
  let resolve!: (value: { text: string; fingerprint: string }) => void;
  const request = cache.load("file", () => new Promise((done) => { resolve = done; }));
  cache.clear();
  resolve({ text: "old", fingerprint: "old" });
  await request;
  expect(cache.get("file")).toBeUndefined();
  await cache.load("file", async () => ({ text: "new", fingerprint: "new" }));
  expect(cache.get("file")?.text).toBe("new");
});

it("retries failed reads and bounds cached memory", async () => {
  const cache = createDiffCache();
  await expect(cache.load("file", async () => { throw Error("changed"); })).rejects.toThrow("changed");
  for (let i = 0; i < 25; i++) await cache.load(String(i), async () => ({ text: "diff", fingerprint: String(i) }));
  expect(cache.get("0")).toBeUndefined();
  expect(cache.get("24")?.fingerprint).toBe("24");
  await cache.load("large", async () => ({ text: "x".repeat(20 * 1024 * 1024), fingerprint: "large" }));
  expect(cache.get("large")?.fingerprint).toBe('large');
  await cache.load("second-large", async () => ({ text: "x".repeat(20 * 1024 * 1024), fingerprint: "second" }));
  expect(cache.get("large")).toBeUndefined();
  expect(cache.get("second-large")?.fingerprint).toBe('second');
  cache.clear();
  await cache.load("oversized", async () => ({ text: "x".repeat(32 * 1024 * 1024 + 1), fingerprint: "oversized" }));
  expect(cache.get("oversized")).toBeUndefined();
});
