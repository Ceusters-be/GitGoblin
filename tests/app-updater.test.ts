// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { compileScript, parse } from '@vue/compiler-sfc';
import { ModuleKind, transpile } from 'typescript';
import * as Vue from 'vue';
import { afterEach, expect, it, vi } from 'vitest';
const check = vi.fn(), relaunch = vi.fn();
const modules: Record<string, unknown> = { vue: Vue, '@tauri-apps/api/core': { isTauri: () => true }, '@tauri-apps/plugin-updater': { check }, '@tauri-apps/plugin-process': { relaunch } };
const { descriptor } = parse(readFileSync('app/components/AppUpdater.vue', 'utf8').replace('import.meta.env.DEV', 'true'));
const compiled = compileScript(descriptor, { id: 'updater', inlineTemplate: true });
const exports: { default?: Vue.Component } = {};
new Function('require', 'exports', transpile(compiled.content, { module: ModuleKind.CommonJS }))((name: string) => modules[name], exports);
let app: Vue.App;
afterEach(() => { app?.unmount(); document.body.innerHTML = ''; vi.clearAllMocks(); });
function mount() {
  const host = document.createElement('div'); document.body.append(host);
  app = Vue.createApp({ render: () => Vue.h(exports.default!) });
  app.component('AppButton', { render() { return Vue.h('button', this.$attrs, this.$slots.default?.()); } });
  app.mount(host);
  return { button: () => host.querySelector('button')! };
}
function available() {
  const update = { version: '0.2.0', download: vi.fn().mockResolvedValue(undefined), install: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) };
  check.mockResolvedValue(update); return update;
}
it('installs and relaunches on click once the download is ready', async () => {
  const update = available(); const view = mount();
  view.button().click(); await vi.waitFor(() => expect(view.button().textContent).toContain('Restart'));
  expect(update.install).not.toHaveBeenCalled();
  view.button().click();
  await vi.waitFor(() => expect(relaunch).toHaveBeenCalledOnce());
  expect(update.install.mock.invocationCallOrder[0]).toBeLessThan(relaunch.mock.invocationCallOrder[0]!);
});
it('keeps the download when installation fails and retries', async () => {
  const update = available(); update.install.mockRejectedValueOnce(new Error('Busy'));
  const view = mount(); view.button().click();
  await vi.waitFor(() => expect(view.button().textContent).toContain('Restart')); view.button().click();
  await vi.waitFor(() => expect(view.button().title).toContain('Busy')); expect(relaunch).not.toHaveBeenCalled();
  view.button().click(); await vi.waitFor(() => expect(relaunch).toHaveBeenCalledOnce());
});
it('retries failed downloads without installing partial data', async () => {
  const update = available(); update.download.mockRejectedValueOnce(new Error('Offline'));
  const view = mount(); view.button().click(); await vi.waitFor(() => expect(view.button().textContent).toContain('Retry'));
  view.button().click(); await vi.waitFor(() => expect(view.button().textContent).toContain('Restart'));
  expect(update.close).toHaveBeenCalledOnce(); expect(update.install).not.toHaveBeenCalled();
});
