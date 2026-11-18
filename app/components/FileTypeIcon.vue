<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ path: string; size: number }>();
const icons = import.meta.glob<string>("../assets/file-icons/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});
const aliases: Record<string, string> = {
  mjs: "js", cjs: "js", mts: "ts", cts: "ts", yml: "yaml",
  svgz: "svg", img: "image", png: "image", apng: "image", jpg: "image",
  jpeg: "image", jfif: "image", gif: "image", bmp: "image", ico: "image",
  tif: "image", tiff: "image", heic: "image", heif: "image",
  icns: "image", woff: "font", woff2: "font", ttf: "font", otf: "font",
  slnx: "sln", cshtml: "razor", props: "xml", targets: "xml", nuspec: "nuget",
  ps1: "powershell", psm1: "powershell", sh: "shell", bash: "shell", txt: "text",
};
const filenames: Record<string, string> = {
  dockerfile: "docker", ".dockerignore": "docker", ".gitignore": "git",
  ".gitattributes": "git", ".gitmodules": "git", ".editorconfig": "editorconfig",
  "package.json": "npm", "package-lock.json": "npm", ".npmrc": "npm",
  "cargo.toml": "cargo", "cargo.lock": "cargo", "nuget.config": "nuget",
  "nuxt.config.ts": "nuxt", "vite.config.ts": "vite", "vitest.config.ts": "vitest",
  "tauri.conf.json": "tauri", license: "license",
};
const src = computed(() => {
  const name = props.path.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  const extension = name.match(/\.([^.]+)$/)?.[1] ?? "";
  const icon = filenames[name] ?? aliases[extension] ?? extension;
  return icons[`../assets/file-icons/${icon}.svg`] ?? icons["../assets/file-icons/default.svg"];
});
</script>

<template>
  <img :src="src" :width="size" :height="size" alt="" class="shrink-0" />
</template>
