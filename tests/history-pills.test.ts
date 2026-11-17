// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { compileScript, parse } from "@vue/compiler-sfc";
import { ModuleKind, transpile } from "typescript";
import * as Vue from "vue";
import * as refs from "../app/lib/history-refs";
import * as graph from "../app/lib/graph";
import { expect, it, vi } from "vitest";

it("renders tags and branches as separate pills and preserves commit selection", () => {
  const { descriptor } = parse(readFileSync("app/components/HistoryList.vue", "utf8"));
  const compiled = compileScript(descriptor, { id: "HistoryList", inlineTemplate: true });
  const exports: any = {};
  const modules: Record<string, unknown> = { vue: Vue, "~/lib/history-refs": refs, "~/lib/graph": graph };
  new Function("require", "exports", transpile(compiled.content, { module: ModuleKind.CommonJS }))(
    (name: string) => modules[name], exports,
  );
  const commit = { id: "abc", parents: "", refs: "HEAD -> main, tag: v1.0.1, origin/main, origin/HEAD", subject: "Release", author: "Test", date: "2026-11-17" };
  const select = vi.fn();
  const host = document.createElement("div");
  const app = Vue.createApp(exports.default, { commits: [commit], loading: false, hasMore: false, onSelect: select });
  app.component("AppButton", { setup: (_, { slots }) => () => Vue.h("button", slots.default?.()) });
  app.component("HistoryGraph", { render: () => null });
  try {
    app.mount(host);
    expect([...host.querySelectorAll(".ref-label")].map(el => el.textContent)).toEqual(["main", "tag: v1.0.1", "origin/main"]);
    expect(host.querySelector(".tag-label")?.textContent).toBe("tag: v1.0.1");
    (host.querySelector(".commit-row") as HTMLButtonElement).click();
    expect(select.mock.calls[0]?.[0].id).toBe(commit.id);
  } finally {
    app.unmount();
  }
});

