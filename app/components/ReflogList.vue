<script setup lang="ts">
import { computed } from "vue";
import { ArrowUpRight, GitBranch, GitCommitHorizontal } from "lucide-vue-next";

const props = defineProps<{ log?: string; loading: boolean; disabled?: boolean }>();
defineEmits<{ recover: [commit: string] }>();

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const entries = computed(() =>
  (props.log ?? "").split(/\r?\n/).filter(Boolean).map((line) => {
    const [id = "", selector = "", ...parts] = line.split("\t");
    const subject = parts.join("\t");
    const checkout = /^checkout: moving from (.+) to (.+)$/.exec(subject);
    const iso = /@\{(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})\}$/.exec(selector);
    const date = iso ? new Date(`${iso[1]}T${iso[2]}${iso[3]}:${iso[4]}`) : undefined;
    const displayTime = date && !Number.isNaN(date.getTime()) ? dateFormat.format(date) : selector;
    return { id, selector, subject, checkout, displayTime };
  }),
);
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto" :aria-busy="loading">
    <table v-if="entries.length" class="w-full min-w-[560px] table-fixed border-separate border-spacing-0 text-left text-[12px]" aria-label="Recent reflog entries">
      <thead class="sticky top-0 z-[1] bg-[var(--panel)] text-[10px] font-medium text-[var(--muted)] [&_th]:border-y [&_th]:border-solid [&_th]:border-[var(--line)]">
        <tr>
          <th scope="col" class="py-[8px] pl-[16px]">Activity</th>
          <th scope="col" class="w-[100px] px-[8px]">Commit</th>
          <th scope="col" class="w-[166px] px-[8px]">Time</th>
          <th scope="col" class="w-[146px]"><span class="sr-only">Recovery</span></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(entry, index) in entries"
          :key="index"
          class="hover:bg-[var(--hover)] focus-within:bg-[var(--hover)] [&>td]:border-b [&>td]:border-solid [&>td]:border-[var(--line)] last:[&>td]:border-b-0"
        >
          <td class="py-[8px] pl-[16px] pr-[12px]">
            <div class="flex min-w-0 items-center gap-[9px]" :title="entry.subject">
              <component :is="entry.checkout ? GitBranch : GitCommitHorizontal" :size="15" class="shrink-0 text-[var(--muted)]" aria-hidden="true" />
              <div class="min-w-0">
                <div v-if="entry.checkout" class="truncate">
                  <span class="text-[var(--fg-secondary)]">Switched to</span>
                  <span class="ml-[4px] font-medium">{{ entry.checkout[2] }}</span>
                </div>
                <div v-else class="truncate">{{ entry.subject || "HEAD updated" }}</div>
                <div v-if="entry.checkout" class="mt-[2px] truncate text-[11px] text-[var(--muted)]">
                  From {{ entry.checkout[1] }}
                </div>
              </div>
            </div>
          </td>
          <td class="px-[8px]">
            <code class="font-mono text-[11px] text-[var(--fg-secondary)]" :title="entry.id">{{ entry.id.slice(0, 8) }}</code>
          </td>
          <td class="whitespace-nowrap px-[8px] text-[11px] tabular-nums text-[var(--muted)]" :title="entry.selector">
            {{ entry.displayTime }}
          </td>
          <td class="pr-[12px] text-right">
            <AppButton
              type="button"
              class="gap-[5px] px-[7px] py-[5px] text-[11px] text-[var(--accent)]"
              :disabled="disabled"
              :aria-label="`Recover branch at ${entry.id.slice(0, 8)}`"
              @click="$emit('recover', entry.id)"
            >
              Recover branch <ArrowUpRight :size="13" aria-hidden="true" />
            </AppButton>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="m-0 px-[16px] py-[18px] text-[12px] text-[var(--muted)]" role="status">
      {{ loading ? "Loading reflog…" : log === undefined ? "Reflog unavailable." : "No reflog entries yet." }}
    </p>
  </div>
</template>
