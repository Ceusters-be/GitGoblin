import { expect, it } from 'vitest';
import { diffGeometry } from '../app/lib/diff-geometry';

it('keeps split rows, navigation, patch indices and change positions aligned', () => {
  const text = 'diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1,2 +1,2 @@\n-old\n+new\n context\n';
  const split = diffGeometry(text, 'split', 23, 11);
  const hunk = split.files[0]!.hunks[0]!;
  expect(hunk.rows).toHaveLength(2);
  expect(hunk.rows[0]!.left!.index).toBe(4);
  expect(hunk.rows[0]!.right!.index).toBe(5);
  expect(split.changes.map(change => change.offset)).toEqual([79, 79]);
  expect(split.navigationFiles[0]!.path).toBe('a.txt');
  expect(diffGeometry(text, 'unified', 23, 11).files[0]!.hunks[0]!.count).toBe(3);
  expect(diffGeometry(text, 'split', 23, 11, 'missing.txt').files).toEqual([]);
});
