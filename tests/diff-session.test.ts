import { expect, it } from 'vitest';
import { createDiffSession } from '../app/lib/diff-session';

it('retains large diffs in the worker and transfers only visible lines and compact markers', () => {
  const receive = createDiffSession();
  const text = 'diff --git a/large.txt b/large.txt\nnew file mode 100644\n--- /dev/null\n+++ b/large.txt\n@@ -0,0 +1,400000 @@\n' + '+content\n'.repeat(400000);
  const options = { id: 1, layout: 'split', rowHeight: 23, fontSize: 11, selectedFile: '', scroll: 0, height: 600 };
  const first = receive({ ...options, text });
  expect(first.error).toBeUndefined();
  expect(first.view!.files[0]!.hunks[0]!.visibleRows.length).toBeLessThan(60);
  expect(first.view!.changes).toHaveLength(1);
  expect(JSON.stringify(first).length).toBeLessThan(25000);
  const last = receive({ ...options, id: 2, scroll: 9_199_700 });
  expect(last.view!.files[0]!.hunks[0]!.visibleRows.at(-1)!.right!.next).toBe(400000);
  const patch = receive({ id: 3, patch: true, hunkStart: 4, reverse: false });
  expect(patch.error).toBeUndefined();
  expect(patch.patch!.match(/^\+content$/gm)).toHaveLength(400000);
  const resized = receive({ ...options, id: 4, rowHeight: 32, fontSize: 20 });
  expect(resized.view!.changes[0]!.height).toBe(400000 * 32);
});
