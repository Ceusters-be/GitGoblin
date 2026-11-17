<script setup lang="ts">
import { computed } from "vue";
import {
  Check,
  Circle,
  CircleAlert,
  LoaderCircle,
  MessageCircleQuestion,
} from "lucide-vue-next";
import { chatState } from "~/lib/chat-tabs";
const props = defineProps<{
  attention?: boolean;
  running?: boolean;
  unread?: boolean;
  completed?: boolean;
  status?: string;
}>();
const state = computed(() => chatState(props));
const labels = {
  waiting: "Waiting for input",
  working: "Working",
  done: "Done",
  ready: "Ready",
  failed: "Failed",
};
</script>
<template>
  <span
    class="chat-status relative inline-flex items-center shrink-0 [&_.waiting]:text-[var(--warning)] [&_.waiting]:bg-[var(--warning-bg)] [&_.working]:text-[var(--accent)] [&_.working]:bg-[var(--selection)] [&_.done]:text-[var(--success)] [&_.done]:bg-[var(--success-bg)] [&_.ready]:text-[var(--fg-secondary)] [&_.ready]:bg-[var(--selection)] [&_.failed]:text-[var(--danger)] [&_.failed]:bg-[var(--danger-bg)]"
    :title="`${labels[state]}${unread ? ' · Unread response' : ''}`"
  >
    <span
      class="state-badge inline-flex items-center justify-center w-[22px] h-[22px] rounded-full shadow-[inset_0_0_0_1px_color-mix(in_srgb,_currentColor_22%,_transparent)]"
      :class="state"
      role="img"
      :aria-label="labels[state]"
    >
      <MessageCircleQuestion
        v-if="state === 'waiting'"
        :size="12"
        aria-hidden="true"
      />
      <LoaderCircle
        v-else-if="state === 'working'"
        :size="12"
        class="spin animate-spin"
        aria-hidden="true"
      />
      <Check v-else-if="state === 'done'" :size="12" aria-hidden="true" />
      <CircleAlert
        v-else-if="state === 'failed'"
        :size="12"
        aria-hidden="true"
      />
      <Circle v-else :size="7" aria-hidden="true" />
    </span>
    <span
      v-if="unread"
      class="unread absolute top-[-1px] right-[-1px] w-[6px] h-[6px] rounded-full bg-[var(--selection)] shadow-[0_0_0_2px_var(--raised)]"
      role="img"
      aria-label="Unread response"
    />
  </span>
</template>
