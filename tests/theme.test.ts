// @vitest-environment happy-dom
import { createApp, h } from 'vue';
import { afterEach, expect, it, vi } from 'vitest';
import { useTheme } from '../app/composables/useTheme';

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup());
  vi.restoreAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
function mountTheme(dark = false) {
  let listener: (() => void) | undefined;
  const media = { matches: dark, addEventListener: vi.fn((_, fn) => { listener = fn; }), removeEventListener: vi.fn() };
  vi.spyOn(window, 'matchMedia').mockReturnValue(media as unknown as MediaQueryList);
  let state!: ReturnType<typeof useTheme>;
  const app = createApp({ setup() { state = useTheme(); return () => h('div'); } });
  app.mount(document.createElement('div'));
  cleanups.push(() => app.unmount());
  return { state, media, change(dark: boolean) { media.matches = dark; listener?.(); } };
}
it('follows device changes only for System and saves explicit choices', () => {
  const { state, change } = mountTheme();
  expect(document.documentElement.dataset.theme).toBe('daylight');
  change(true);
  expect(document.documentElement.dataset.theme).toBe('midnight');
  state.setTheme('daylight');
  expect(localStorage.getItem('gitgoblin.theme')).toBe('daylight');
  change(false); change(true);
  expect(document.documentElement.dataset.theme).toBe('daylight');
  state.setTheme('system');
  expect(document.documentElement.dataset.theme).toBe('midnight');
});
it('restores saved choices and ignores invalid stored themes', () => {
  localStorage.setItem('gitgoblin.theme', 'midnight');
  expect(mountTheme().state.theme.value).toBe('midnight');
  localStorage.setItem('gitgoblin.theme', 'invalid');
  expect(mountTheme().state.theme.value).toBe('system');
});
it('applies the theme even when saving fails and removes the media listener', () => {
  const { state, media } = mountTheme();
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  state.setTheme('midnight');
  expect(document.documentElement.dataset.theme).toBe('midnight');
  expect(state.error.value).toContain('could not save');
  cleanups.splice(0).forEach(cleanup => cleanup());
  expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
});
