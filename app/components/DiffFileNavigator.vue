<script setup lang="ts">
import FileTypeIcon from "./FileTypeIcon.vue";
import { computed, ref, useId, watch } from 'vue';
import { ChevronRight, ChevronDown, Folder } from 'lucide-vue-next';
import { fileTree, fileChange, type FileNode } from '~/lib/files';
import type { FileStatus } from '~/lib/types';
const props = defineProps<{ files: FileStatus[]; selected: string; reviewKey?: string }>();
const emit = defineEmits<{ select: [path: string] }>();
const checked = ref(new Set<string>());
watch(() => props.reviewKey, key => {
  checked.value = new Set();
  if (!key) return;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "[]");
    if (Array.isArray(saved)) checked.value = new Set(saved.filter(path => typeof path === "string"));
  } catch { /* Keep the checklist usable when storage is unavailable. */ }
}, { immediate: true });
function toggleReviewed(path: string) {
  if (!props.reviewKey) return;
  if (checked.value.has(path)) checked.value.delete(path);
  else checked.value.add(path);
  try { localStorage.setItem(props.reviewKey, JSON.stringify(Array.from(checked.value))); } catch { /* Session only. */ }
}
const reviewedCount = computed(() => props.files.filter(file => checked.value.has(file.path)).length);
const navigatorId = useId();
const width = ref<number>();
const tree = ref(true);
const filter = ref('');
const collapsed = ref(new Set<string>());
const rows = computed(() => {
  const filtered = props.files.filter(file => file.path.toLowerCase().includes(filter.value.toLowerCase()));
  if (!tree.value) return filtered.map(file => ({ name: file.path, path: file.path, file, depth: 0 }));
  const result: { name: string; path: string; file?: FileStatus; depth: number }[] = [];
  function visit(nodes: FileNode[], depth: number) {
    for (const node of nodes) {
      result.push({ ...node, depth });
      if (filter.value || !collapsed.value.has(node.path)) visit(node.children, depth + 1);
    }
  }
  visit(fileTree(filtered), 0);
  return result;
});
function toggle(path: string) {
  if (collapsed.value.has(path)) collapsed.value.delete(path);
  else collapsed.value.add(path);
}
</script>
<template>
  <nav :id="navigatorId" aria-label="Changed files" :style="{ width: `${Math.max(160, Math.min(600, width ?? 250))}px` }" class="relative w-[250px] max-w-[40%] shrink-0 flex flex-col min-h-0 border-r border-[var(--line)] bg-[var(--bg)] text-[11px]">
    <div class="flex items-center justify-between p-2 gap-2">
      <strong>Files ({{ files.length }})</strong>
      <div class="flex gap-1">
        <AppButton :aria-pressed="tree" @click="tree = true">Tree</AppButton>
        <AppButton :aria-pressed="!tree" @click="tree = false">List</AppButton>
      </div>
    </div>
    <div v-if="reviewKey" class="px-2 pb-2 text-[var(--muted)]">
      {{ reviewedCount }} of {{ files.length }} files reviewed
      <progress class="block w-full h-1 mt-1 accent-[var(--accent)]" :value="reviewedCount" :max="files.length" />
    </div>
    <AppInput v-model="filter" aria-label="Filter changed files" placeholder="Filter files…" class="mx-2 mb-2 min-w-0" />
    <AppButton :aria-pressed="!selected" class="justify-start text-left px-3 py-2" @click="emit('select', '')">All files</AppButton>
    <div class="overflow-auto min-h-0 flex-1 p-1">
      <div v-for="row in rows" :key="row.path" class="flex items-center" :style="{ paddingLeft: `${row.depth * 14}px` }">
      <input v-if="reviewKey && row.file" type="checkbox" class="mx-1 shrink-0 accent-[var(--accent)]"
        :aria-label="`Mark ${row.path} as reviewed`" :checked="checked.has(row.path)" @change="toggleReviewed(row.path)" />
      <template v-if="!row.file">
        <AppButton type="button" class="size-6 shrink-0 p-0" :aria-label="`Toggle folder ${row.path}`"
          :aria-expanded="!!filter || !collapsed.has(row.path)" :disabled="!!filter" @click="toggle(row.path)">
          <ChevronRight v-if="collapsed.has(row.path) && !filter" :size="12" /><ChevronDown v-else :size="12" />
        </AppButton>
        <Folder :size="13" class="shrink-0" />
        <span class="ml-1.5 truncate" :title="row.path">{{ row.name }}</span>
      </template>
      <AppButton v-else :title="row.path"
        :aria-current="row.file && selected === row.path ? 'true' : undefined"
        class="flex items-center justify-start w-full gap-1.5 py-1 text-left text-[11px] [&[aria-current=true]]:bg-[var(--raised)] [&[aria-current=true]]:text-[var(--fg)]"
        style="padding-left: 6px; min-width: 0"
        @click="emit('select', row.path)">
        <span v-if="tree" class="w-[12px] shrink-0" aria-hidden="true" />
        <FileTypeIcon :path="row.path" :size="16" class="shrink-0" />
        <span class="truncate">{{ row.name }}</span>
        <span v-if="row.file" class="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] [&.added]:bg-[var(--success-bg)] [&.added]:text-[var(--success)] [&.removed]:bg-[var(--danger-bg)] [&.removed]:text-[var(--danger)] [&.modified]:bg-[var(--warning-bg)] [&.modified]:text-[var(--warning)] [&.renamed]:bg-[var(--selection)] [&.renamed]:text-[var(--fg)]" :class="fileChange(row.file, 'staged').kind" :title="fileChange(row.file, 'staged').label">{{ fileChange(row.file, 'staged').label }}</span>
      </AppButton></div>
      <p v-if="!rows.length" class="p-2 text-[var(--muted)]">No matching files</p>
    </div>
    <ResizeHandle
      v-model="width"
      label="Resize changed files"
      :controls="navigatorId"
      storage-key="gitgoblin.diffFilesWidth"
      :min="160"
      :max="600"
    />
  </nav>
</template>
