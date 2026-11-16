import type { Diff } from "./types";

export function createDiffCache() {
  const entries = new Map<string, Diff>();
  const pending = new Map<string, Promise<Diff>>();
  const backgroundRequests = new Set<Promise<Diff>>();
  const maxCharacters = 32 * 1024 * 1024;
  let characters = 0;
  let generation = 0;
  return {
    get: (key: string) => entries.get(key),
    clear() { generation++; entries.clear(); pending.clear(); characters = 0; },
    invalidate(matches: (key: string) => boolean) {
      for (const [key, diff] of entries) if (matches(key)) { characters -= diff.text.length; entries.delete(key); }
      for (const key of pending.keys()) if (matches(key)) pending.delete(key);
    },
    load(key: string, read: () => Promise<Diff>, background = false): Promise<Diff> {
      const existing = pending.get(key);
      if (existing && (background || !backgroundRequests.has(existing))) return existing;
      const current = generation;
      const request = read().then((diff) => {
        if (current === generation && pending.get(key) === request && diff.text.length <= maxCharacters) {
          characters -= entries.get(key)?.text.length || 0;
          entries.delete(key);
          entries.set(key, diff);
          characters += diff.text.length;
          while (entries.size > 24 || characters > maxCharacters) {
            const oldest = entries.keys().next().value!;
            characters -= entries.get(oldest)!.text.length;
            entries.delete(oldest);
          }
        }
        return diff;
      }).finally(() => {
        backgroundRequests.delete(request);
        if (pending.get(key) === request) pending.delete(key);
      });
      pending.set(key, request);
      if (background) backgroundRequests.add(request);
      return request;
    },
  };
}
