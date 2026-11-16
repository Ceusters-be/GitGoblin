import { expect, it } from 'vitest';
import { reactive } from 'vue';
import { fileTree } from '../app/lib/files';
import { parseDiffFiles, splitDiffLines } from '../app/lib/diff';
import { conversationTurns } from '../app/lib/conversation-turns';
import type { T3Projection } from '../app/lib/types';

// Manual baseline: $env:GITGOBLIN_PERF='1'; npm test -- tests/performance.test.ts
it.skipIf(!process.env.GITGOBLIN_PERF)('measures large input processing without network or rendering', () => {
  const timings: { scenario: string; ms: number }[] = [];
  function measure<T>(scenario: string, run: () => T): T {
    const start = performance.now();
    const result = run();
    timings.push({ scenario, ms: Math.round(performance.now() - start) });
    return result;
  }
  for (const count of [598, 5000, 20000]) {
    for (const layout of ['flat', 'folders']) {
      const files = Array.from({ length: count }, (_, i) => ({ path: `${layout === 'flat' ? 'folder' : `folder-${Math.floor(i / 100)}`}/file-${i}.txt`, index: ' ', worktree: 'M', conflict: false }));
      expect(measure(`${count} files ${layout}`, () => fileTree(reactive(files))).length).toBe(layout === 'flat' ? 1 : Math.ceil(count / 100));
    }
  }
  const text = 'diff --git a/large.txt b/large.txt\n--- /dev/null\n+++ b/large.txt\n@@ -0,0 +1,400000 @@\n' + '+a line of generated text with enough content for testing\n'.repeat(400000);
  const parsed = measure('400000-line diff parse', () => parseDiffFiles(text));
  measure('400000-line diff split', () => parsed.flatMap(file => file.hunks.flatMap(hunk => splitDiffLines(hunk.lines))));
  for (const count of [100, 500, 1000]) {
    const projection = reactive({
      messages: Array.from({ length: count }, (_, i) => ({ id: `user-${i}`, role: 'user', text: 'question', createdAt: new Date(i * 1000).toISOString() })),
      runs: Array.from({ length: count }, (_, i) => ({ id: `run-${i}`, userMessageId: `user-${i}`, status: 'completed' })),
      turnItems: Array.from({ length: count * 10 }, (_, i) => ({ id: `item-${i}`, runId: `run-${Math.floor(i / 10)}`, type: 'command_execution', title: 'Run tests', status: 'completed' })),
      activities: [],
    }) as unknown as T3Projection;
    expect(measure(`${count} chat turns / ${count * 10} tool items`, () => conversationTurns(projection))).toHaveLength(count);
  }
  console.table(timings);
  if (process.env.GITGOBLIN_PERF_BUDGET) {
    expect(timings.filter(timing => timing.ms > Number(process.env.GITGOBLIN_PERF_BUDGET))).toEqual([]);
  }
}, 120000);
