import { expect, it, vi } from 'vitest';
import { effectScope, nextTick } from 'vue';
import { useWorkbench } from '../app/composables/useWorkbench';
import { demoSnapshot } from '../app/lib/demo';
import { git } from '../app/lib/native';

vi.mock('vue', async original => ({ ...await original<typeof import('vue')>(), onMounted: vi.fn(), onUnmounted: vi.fn() }));
vi.mock('../app/lib/native', () => ({ desktop: () => true, git: vi.fn(), invoke: vi.fn() }));

it('does not hold the next staging action behind speculative diff reads', async () => {
  const files = ['first.txt', 'next.txt', 'offscreen.txt'].map(path => ({ path, index: ' ', worktree: 'M', conflict: false }));
  let release!: () => void;
  const slowRead = new Promise<void>(done => { release = done; });
  let backgroundReading = false;
  vi.mocked(git).mockImplementation(async request => {
    if (request.action === 'diff') {
      if (request.limit) { backgroundReading = true; await slowRead; }
      return { text: '+content', fingerprint: 'current' };
    }
    if (request.action === 'stage') {
      // Native mutations wait for active repository readers to release their lock.
      if (backgroundReading) await slowRead;
      return 'Index updated';
    }
    return files.slice(1);
  });
  const scope = effectScope();
  const w = scope.run(() => useWorkbench())!;
  w.repo.value = demoSnapshot.root;
  w.snapshot.value = { ...demoSnapshot, files };
  w.selected.value = 'first.txt';
  let second: Promise<unknown> | undefined;
  try {
    await w.stageFiles(['first.txt'], 'working');
    let finished = false;
    second = w.stageFiles(['next.txt'], 'working').then(() => { finished = true; });
    for (let i = 0; i < 20; i++) await nextTick();
    expect(finished).toBe(true);
    expect(w.busy.value).toBe(false);
  } finally {
    release();
    await second;
    scope.stop();
  }
});

it.each(['working', 'staged'])('updates %s file lists without waiting for metadata, history or the next diff', async mode => {
  const file = { path: 'file.txt', index: mode === 'staged' ? 'M' : ' ', worktree: mode === 'staged' ? ' ' : 'M', conflict: false };
  vi.mocked(git).mockImplementation(async request => {
    if (request.action === 'diff') return { text: '+reviewed', fingerprint: 'reviewed' };
    if (request.action === 'stage' || request.action === 'unstage') return 'Index updated';
    if (request.action === 'status') return [];
    if (request.action === 'snapshot') return { ...demoSnapshot, files: [] };
    return [];
  });
  const scope = effectScope();
  const w = scope.run(() => useWorkbench())!;
  w.repo.value = demoSnapshot.root;
  w.snapshot.value = { ...demoSnapshot, files: [file] };
  w.selected.value = file.path;
  w.mode.value = mode;
  await w.loadDiff();
  vi.mocked(git).mockClear();
  await w.stageFiles([file.path], mode);
  expect(w.snapshot.value.files).toEqual([]);
  expect(w.busy.value).toBe(false);
  expect(vi.mocked(git).mock.calls.map(([request]) => request.action)).toEqual([mode === 'staged' ? 'unstage' : 'stage', 'status']);
  expect(vi.mocked(git).mock.calls[0]![0].fingerprint).toBeUndefined();
  scope.stop();
});

it.each(['working', 'staged'])('updates an unreviewed %s file without loading its diff first', async mode => {
  vi.mocked(git).mockImplementation(async request => {
    if (request.action === 'diff') throw new Error('Staging must not load a diff');
    return request.action === 'status' ? [] : 'Index updated';
  });
  const scope = effectScope();
  const w = scope.run(() => useWorkbench())!;
  w.repo.value = demoSnapshot.root;
  w.snapshot.value = { ...demoSnapshot, files: [] };
  vi.mocked(git).mockClear();
  await w.stageFiles(['unreviewed.txt'], mode);
  expect(vi.mocked(git).mock.calls.map(([request]) => request.action)).toEqual([mode === 'staged' ? 'unstage' : 'stage', 'status']);
  scope.stop();
});

it('makes the next staging action available while the next file diff is still loading', async () => {
  const file = (path: string) => ({ path, index: ' ', worktree: 'M', conflict: false });
  let finishDiff!: (value: { text: string; fingerprint: string }) => void;
  vi.mocked(git).mockImplementation(async request => {
    if (request.action === 'stage') return 'Index updated';
    if (request.action === 'status') return [file('next.txt')];
    if (request.path === 'next.txt') return new Promise(done => { finishDiff = done; });
    return { text: '+reviewed', fingerprint: 'reviewed' };
  });
  const scope = effectScope();
  const w = scope.run(() => useWorkbench())!;
  w.repo.value = demoSnapshot.root;
  w.snapshot.value = { ...demoSnapshot, files: [file('first.txt'), file('next.txt')] };
  w.selected.value = 'first.txt';
  await w.loadDiff();
  await w.stageFiles(['first.txt'], 'working');
  expect(w.selected.value).toBe('next.txt');
  expect(w.busy.value).toBe(false);
  expect(w.diffLoading.value).toBe(true);
  finishDiff({ text: '+next', fingerprint: 'next' });
  await Promise.resolve();
  scope.stop();
});

it('refreshes the list after a partial failure without hiding the failure', async () => {
  vi.mocked(git).mockImplementation(async request => {
    if (request.action === 'stage') throw new Error('Git index is locked');
    if (request.action === 'status') return [];
    return { text: '+reviewed', fingerprint: 'reviewed' };
  });
  const scope = effectScope();
  const w = scope.run(() => useWorkbench())!;
  w.repo.value = demoSnapshot.root;
  w.snapshot.value = { ...demoSnapshot, files: [] };
  await expect(w.stageFiles(['file.txt'], 'working')).rejects.toThrow('0 of 1 files staged');
  expect(w.error.value).toContain('Git index is locked');
  expect(w.busy.value).toBe(false);
  expect(vi.mocked(git).mock.lastCall?.[0].action).toBe('status');
  scope.stop();
});

it.each(['stage', 'unstage', 'patch'])('uses the fast refresh for the diff viewer %s action too', async action => {
  vi.mocked(git).mockImplementation(async request => request.action === 'status' ? [] : 'Index updated');
  const scope = effectScope();
  const w = scope.run(() => useWorkbench())!;
  w.repo.value = demoSnapshot.root;
  w.snapshot.value = { ...demoSnapshot, files: [] };
  vi.mocked(git).mockClear();
  await w.mutate(action, { path: 'file.txt', fingerprint: 'reviewed' });
  expect(vi.mocked(git).mock.calls.map(([request]) => request.action)).toEqual([action, 'status']);
  scope.stop();
});

it.each(['working', 'staged'])('handles 598 %s files with one bulk mutation and one status refresh', async mode => {
  vi.mocked(git).mockImplementation(async request => request.action === 'status' ? [] : '598 files updated');
  const scope = effectScope();
  const w = scope.run(() => useWorkbench())!;
  w.repo.value = demoSnapshot.root;
  w.snapshot.value = { ...demoSnapshot, files: [] };
  const paths = Array.from({ length: 598 }, (_, i) => `folder/file-${i}.txt`);
  vi.mocked(git).mockClear();
  await w.stageFiles(paths, mode);
  expect(vi.mocked(git).mock.calls.map(([request]) => request.action)).toEqual([mode === 'staged' ? 'unstage-files' : 'stage-files', 'status']);
  expect(vi.mocked(git).mock.calls[0]![0].files?.map(file => file.path)).toEqual(paths);
  expect(w.busy.value).toBe(false);
  scope.stop();
});

it('moves files immediately and queues index writes while Git is still running', async () => {
  let finish!: () => void;
  const blocked = new Promise<void>(resolve => { finish = resolve; });
  const files = ['first.txt', 'next.txt'].map(path => ({ path, index: ' ', worktree: 'M', conflict: false }));
  const actions: string[] = [];
  vi.mocked(git).mockImplementation(async request => {
    if (request.action === 'stage') {
      actions.push(request.path!);
      await blocked;
      files.find(file => file.path === request.path)!.index = 'M';
      files.find(file => file.path === request.path)!.worktree = ' ';
      return 'Index updated';
    }
    if (request.action === 'status') return files.map(file => ({ ...file }));
    return { text: '', fingerprint: '' };
  });
  const scope = effectScope();
  const w = scope.run(() => useWorkbench())!;
  w.repo.value = demoSnapshot.root;
  w.snapshot.value = { ...demoSnapshot, files: files.map(file => ({ ...file })) };
  const first = w.stageFiles(['first.txt'], 'working');
  let second: Promise<unknown> | undefined;
  try {
    expect(w.working.value.map(file => file.path)).toEqual(['next.txt']);
    expect(w.staged.value.map(file => file.path)).toEqual(['first.txt']);
    second = w.stageFiles(['next.txt'], 'working');
    expect(w.working.value).toEqual([]);
    await nextTick();
    expect(actions).toEqual(['first.txt']);
    await expect(w.mutate('commit', { text: 'Too soon' })).rejects.toThrow('Wait');
  } finally {
    finish();
    await first;
    await second;
    scope.stop();
  }
  expect(actions).toEqual(['first.txt', 'next.txt']);
  expect(w.busy.value).toBe(false);
});

it.each(['working', 'staged'])('rolls back an optimistic %s move when Git rejects it', async mode => {
  let fail!: (error: Error) => void;
  const blocked = new Promise<never>((_, reject) => { fail = reject; });
  const file = { path: 'file.txt', index: mode === 'staged' ? 'A' : '?', worktree: mode === 'staged' ? ' ' : '?', conflict: false };
  vi.mocked(git).mockImplementation(async request => {
    if (request.action === 'stage' || request.action === 'unstage') return blocked;
    if (request.action === 'status') return [file];
    return { text: '', fingerprint: '' };
  });
  const scope = effectScope();
  const w = scope.run(() => useWorkbench())!;
  w.repo.value = demoSnapshot.root;
  w.snapshot.value = { ...demoSnapshot, files: [file] };
  const operation = w.stageFiles([file.path], mode);
  expect(mode === 'staged' ? w.staged.value : w.working.value).toEqual([]);
  fail(new Error('Index locked'));
  await expect(operation).rejects.toThrow('Index locked');
  expect(mode === 'staged' ? w.staged.value : w.working.value).toEqual([file]);
  expect(w.error.value).toContain('Index locked');
  expect(w.busy.value).toBe(false);
  scope.stop();
});

it('keeps later queued moves visible after an earlier write fails', async () => {
  let fail!: (error: Error) => void;
  let finish!: () => void;
  const firstWrite = new Promise<never>((_, reject) => { fail = reject; });
  const secondWrite = new Promise<void>(resolve => { finish = resolve; });
  const files = ['first.txt', 'next.txt'].map(path => ({ path, index: ' ', worktree: 'M', conflict: false }));
  vi.mocked(git).mockImplementation(async request => {
    if (request.action === 'stage') {
      if (request.path === 'first.txt') return firstWrite;
      await secondWrite;
      files[1] = { ...files[1]!, index: 'M', worktree: ' ' };
      return 'Done';
    }
    if (request.action === 'status') return files.map(file => ({ ...file }));
    return { text: '', fingerprint: '' };
  });
  const scope = effectScope();
  const w = scope.run(() => useWorkbench())!;
  w.repo.value = demoSnapshot.root;
  w.snapshot.value = { ...demoSnapshot, files: files.map(file => ({ ...file })) };
  const first = w.stageFiles(['first.txt'], 'working');
  const second = w.stageFiles(['next.txt'], 'working');
  fail(new Error('Index locked'));
  await expect(first).rejects.toThrow('Index locked');
  expect(w.working.value.map(file => file.path)).toEqual(['first.txt']);
  expect(w.staged.value.map(file => file.path)).toEqual(['next.txt']);
  expect(w.busy.value).toBe(true);
  finish();
  await second;
  expect(w.error.value).toContain('Index locked');
  expect(w.busy.value).toBe(false);
  scope.stop();
});
