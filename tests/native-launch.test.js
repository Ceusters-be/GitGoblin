import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const { run } = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('@tauri-apps/cli', () => ({ default: { run } }));
const originalArgv = process.argv;
const originalPath = process.env.PATH;
afterEach(() => {
  process.argv = originalArgv;
  process.env.PATH = originalPath;
  vi.resetModules();
  run.mockClear();
});

it('names development windows while preserving their existing settings', async () => {
  process.argv = ['node', 'scripts/native.mjs', 'dev'];
  await import('../scripts/native.mjs');
  const [args] = run.mock.calls[0];
  const config = JSON.parse(args[2]);
  const base = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
  expect(args.slice(0, 2)).toEqual(['dev', '--config']);
  expect(config.productName).toBe('GitGoblin (development)');
  expect(config.app.windows).toEqual(base.app.windows.map(window => ({ ...window, title: config.productName })));
  expect(config.identifier).toBeUndefined();
});

it('leaves release build arguments unchanged', async () => {
  process.argv = ['node', 'scripts/native.mjs', 'build', '--bundles', 'nsis'];
  await import('../scripts/native.mjs');
  expect(run).toHaveBeenCalledWith(['build', '--bundles', 'nsis'], 'gitgoblin');
});
