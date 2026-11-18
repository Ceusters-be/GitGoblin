<script setup lang="ts">
import { ref } from "vue";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "reka-ui";
import type { ContextMenuItem as Item } from "~/lib/context-menu";

const emit = defineEmits<{ error: [message: string] }>();
const expanded = ref(false),
  items = ref<Item[]>([]);
const point = ref({ left: "0px", top: "0px" });
let trigger: HTMLElement | undefined;

function open(event: MouseEvent | KeyboardEvent, actions: Item[]) {
  event.preventDefault();
  trigger = event.currentTarget as HTMLElement;
  if (!trigger.matches("button, [tabindex]"))
    trigger =
      trigger.querySelector<HTMLElement>("button, [tabindex]") || trigger;
  const rect = trigger.getBoundingClientRect();
  const mouse = event instanceof MouseEvent && (event.clientX || event.clientY);
  point.value = {
    left: `${mouse ? event.clientX : rect.left}px`,
    top: `${mouse ? event.clientY : rect.bottom}px`,
  };
  items.value = actions;
  expanded.value = true;
}
function close() {
  expanded.value = false;
}
async function choose(item: Item) {
  if (item.disabled) return;
  close();
  try {
    await item.run();
  } catch (error) {
    emit("error", String(error));
  }
}
defineExpose({ open, close });
</script>

<template>
  <ContextMenuRoot v-model:open="expanded" :modal="false">
    <ContextMenuTrigger as-child
      ><span
        class="pointer-events-none fixed size-0"
        :style="point"
        aria-hidden="true"
    /></ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        aria-label="Actions"
        :collision-padding="8"
        :side-offset="0"
        class="sidebar-context-menu z-[160] w-max min-w-[180px] max-w-[min(calc(100vw_-_16px),38rem)] max-h-(--reka-context-menu-content-available-height) overflow-auto rounded-[8px] border border-ui-border bg-ui-menu p-[4px] text-[12px] text-ui-text shadow-lg"
        @close-auto-focus.prevent="trigger?.focus({ preventScroll: true })"
      >
        <template v-for="item in items" :key="item.label">
          <ContextMenuSeparator
            v-if="item.separatorBefore"
            class="mx-[4px] my-[3px] h-px bg-ui-border"
          />
          <ContextMenuItem
            :disabled="item.disabled"
            :text-value="item.label"
            :title="item.disabledReason"
            class="flex min-h-[26px] cursor-pointer flex-col justify-center gap-[2px] rounded-[4px] px-[8px] py-[4px] leading-[16px] outline-none data-[highlighted]:bg-ui-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
            :class="{
              'text-[var(--danger)] data-[highlighted]:bg-[var(--danger-bg)]': item.danger,
            }"
            @select="choose(item)"
          >
            <span class="flex w-full items-baseline justify-between gap-[20px]">
              <span class="min-w-0 [overflow-wrap:anywhere]">{{ item.label }}</span>
              <kbd v-if="item.shortcut" class="shrink-0 font-[inherit] text-[11px] text-ui-muted" aria-hidden="true">{{ item.shortcut }}</kbd>
            </span>
            <small
              v-if="item.disabled && item.disabledReason"
              class="max-w-[240px] whitespace-normal text-[10px] leading-[14px] text-ui-muted"
              >{{ item.disabledReason }}</small
            >
          </ContextMenuItem>
        </template>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
