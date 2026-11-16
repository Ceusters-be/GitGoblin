import { expect, it, vi } from 'vitest';
import { effectScope, nextTick } from 'vue';
import { useWorkbench } from '../app/composables/useWorkbench';
import { demoSnapshot } from '../app/lib/demo';
import { git } from '../app/lib/native';

vi.mock('vue', async original => ({ ...await original<typeof import('vue')>(), onMounted: vi.fn(), onUnmounted: vi.fn() }));
vi.mock('../app/lib/native', () => ({ desktop: () => true, git: vi.fn(), invoke: vi.fn(async () => []) }));

it('uses lightweight polling and conditional diffs, but fully revalidates metadata and head changes', async () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(100000);
  let head = 'initial';
  const files = [{ path: 'file.txt', index: ' ', worktree: 'M', conflict: false }];
  vi.mocked(git).mockImplementation(async request => {
    if (request.action === 'snapshot') return { ...demoSnapshot, files, head };
    if (request.action === 'refresh') return { files, head };
    if (request.action === 'diff') return request.fingerprint
      ? { text: '', fingerprint: 'same', unchanged: true } : { text: '+content', fingerprint: 'same' };
    return [];
  });
  const scope = effectScope();
  const w = scope.run(() => useWorkbench())!;
  try {
    await w.openRepo(demoSnapshot.root);
    await nextTick(); await w.loadDiff();
    vi.mocked(git).mockClear();
    for (let i = 0; i < 24; i++) await w.refresh();
    expect(vi.mocked(git).mock.calls.filter(([req]) => req.action === 'snapshot')).toHaveLength(0);
    expect(vi.mocked(git).mock.calls.filter(([req]) => req.action === 'refresh')).toHaveLength(24);
    expect(vi.mocked(git).mock.calls.filter(([req]) => req.action === 'diff').every(([req]) => req.fingerprint === 'same')).toBe(true);
    expect(w.diff.value.text).toBe('+content');
    clock.mockReturnValue(115001);
    await w.refresh();
    expect(vi.mocked(git).mock.calls.filter(([req]) => req.action === 'snapshot')).toHaveLength(1);
    expect(vi.mocked(git).mock.lastCall![0].fingerprint).toBeUndefined();
    vi.mocked(git).mockClear();
    head = 'external commit';
    await w.refresh();
    expect(vi.mocked(git).mock.calls.map(([req]) => req.action)).toContain('snapshot');
    expect(vi.mocked(git).mock.calls.find(([req]) => req.action === 'diff')![0].fingerprint).toBeUndefined();
  } finally { scope.stop(); clock.mockRestore(); }
});
