<script setup lang="ts">
import { ref, watch } from 'vue';
import { git } from '~/lib/native';

const props = defineProps<{ repo: string; path: string; oldPath?: string; mode: string; target?: string; version: string }>();
const sides = ref<{ label: string; url?: string; failed?: boolean }[]>([]);
const loading = ref(false);
const error = ref('');
watch(() => [props.repo, props.path, props.oldPath, props.mode, props.target, props.version], async (_, __, cleanup) => {
  let active = true;
  const urls: string[] = [];
  cleanup(() => { active = false; urls.forEach(url => URL.revokeObjectURL(url)); });
  sides.value = [];
  error.value = '';
  loading.value = true;
  try {
    const result = await git<{ mime: string; original: number[] | null; modified: number[] | null }>({
      repo: props.repo, action: 'image-diff', path: props.path, text: props.oldPath, mode: props.mode, target: props.target,
    });
    if (!active) return;
    sides.value = (['original', 'modified'] as const).map(side => {
      const data = result[side];
      const url = data === null ? undefined : URL.createObjectURL(new Blob([new Uint8Array(data)], { type: result.mime }));
      if (url) urls.push(url);
      return { label: side === 'original' ? 'Original' : 'Modified', url };
    });
  } catch (e) { if (active) error.value = String(e); }
  finally { if (active) loading.value = false; }
}, { immediate: true });
</script>

<template>
  <div class="image-diff p-[16px]">
    <p v-if="loading" role="status">Loading images...</p>
    <p v-else-if="error" role="status" class="text-[var(--muted)]">{{ error }}</p>
    <div v-else class="grid grid-cols-2 gap-[16px]">
      <figure v-for="side in sides" :key="side.label" class="m-0 min-w-0">
        <figcaption class="mb-[10px] text-[var(--fg-secondary)]">{{ side.label }}</figcaption>
        <div class="image-background min-h-[200px] p-[16px] flex items-center justify-center rounded-[6px] border border-[var(--line)]">
          <img v-if="side.url && !side.failed" :src="side.url" :alt="`${side.label}: ${path}`" class="max-w-full max-h-[60vh] object-contain" @error="side.failed = true" />
          <span v-else class="bg-[var(--panel)] text-[var(--muted)] p-[8px] rounded-[4px]">{{ side.failed ? 'Unable to decode this image.' : 'File does not exist in this version.' }}</span>
        </div>
      </figure>
    </div>
  </div>
</template>

<style scoped>
.image-background {
  background-color: #cbd5e1;
  background-image: conic-gradient(#94a3b8 25%, transparent 0 50%, #94a3b8 0 75%, transparent 0);
  background-size: 20px 20px;
}
</style>
