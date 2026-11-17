<script setup lang="ts">
import type { SyntaxToken } from "~/lib/syntax";
const props = defineProps<{
  text: string;
  path: string;
  editable?: boolean;
  label: string;
  selectable?: boolean;
  selected?: number[];
  selectableRange?: { start: number; end: number };
  activeRange?: { start: number; end: number };
}>();
const emit = defineEmits<{
  "update:text": [text: string];
  toggle: [line: number];
}>();
const tokens = shallowRef<SyntaxToken[][]>([]),
  scroller = ref<HTMLElement>(),
  input = ref<HTMLTextAreaElement>();
const lines = computed(() => props.text.split("\n"));
let worker: Worker | undefined,
  request = 0;
function highlight() {
  tokens.value = [];
  worker?.postMessage({
    id: ++request,
    kind: "code",
    text: props.text,
    path: props.path,
  });
}
onMounted(() => {
  try {
    worker = new Worker(new URL("../lib/syntax.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      if (data.id === request) tokens.value = data.tokens;
    };
    highlight();
  } catch {
    /* Plain code remains available without workers. */
  }
});
onUnmounted(() => worker?.terminate());
watch(() => [props.text, props.path], highlight);
function reveal(offset: number, end: number) {
  const editor = input.value;
  if (!editor) {
    if (scroller.value)
      scroller.value.scrollTop = Math.max(
        0,
        (props.text.slice(0, offset).split("\n").length - 5) * 20,
      );
    return;
  }
  editor.setSelectionRange(offset, end);
  editor.scrollTop = Math.max(
    0,
    (props.text.slice(0, offset).split("\n").length - 5) * 20,
  );
  syncScroll();
}
function syncScroll() {
  if (input.value && scroller.value) {
    scroller.value.scrollTop = input.value.scrollTop;
    scroller.value.scrollLeft = input.value.scrollLeft;
  }
}
defineExpose({ reveal });
</script>
<template>
  <AppCodeSurface
    class="syntax-code [&_.badge]:text-[9px] [&_.badge]:bg-[var(--raised)] [&_.badge]:text-[var(--fg-secondary)] [&_.badge]:py-[3px] [&_.badge]:px-[5px] [&_.badge]:rounded-[4px] [&_.graph-line.last]:bottom-[50%] relative bg-[var(--bg)] border-[1px] border-solid border-[var(--hover)] rounded-[6px] overflow-hidden h-[210px] [&.editable]:h-[280px]"
    :class="[{ editable, selectable }]"
  >
    <div
      ref="scroller"
      class="code-scroll h-full overflow-auto py-[12px] px-0 [.editable_&]:pointer-events-none [.editable_&]:[scrollbar-width:none]"
      :aria-hidden="editable || undefined"
      :aria-label="editable ? undefined : label"
      :tabindex="editable ? undefined : 0"
    >
      <div
        v-for="(line, index) in lines"
        :key="index"
        class="code-row [.segmented_button&.active]:bg-[var(--hover)] [.segmented_button&.active]:text-[var(--fg)] [.segmented_button&.active]:shadow-[0_1px_3px_#0004] flex w-max min-w-full h-[20px] [font:12px/20px_Consolas,_monospace] whitespace-pre [&.active-conflict]:bg-[var(--warning-bg)] [&.active-conflict]:shadow-[inset_3px_0_#cda65c] [&.chosen]:bg-[var(--success-bg)] [tab-size:4]"
        :class="{
          chosen: selected?.includes(index),
          'active-conflict':
            activeRange &&
            index >= activeRange.start &&
            index <= activeRange.end,
        }"
      >
        <AppButton
          v-if="
            selectable &&
            (!selectableRange ||
              (index >= selectableRange.start &&
                index <= selectableRange.end)) &&
            (index < lines.length - 1 || line)
          "
          class="choose-line w-[26px] shrink-0 h-[20px] min-h-0 p-0 border-0 rounded-none bg-[transparent] text-[var(--accent)] hover:bg-[var(--selection)]"
          :aria-label="`Select ${label} line ${index + 1}`"
          :aria-pressed="selected?.includes(index) || false"
          @click="emit('toggle', index)"
        >
          {{ selected?.includes(index) ? "✓" : "+" }}</AppButton
        ><span
          v-else-if="selectable"
          class="choose-line w-[26px] shrink-0 h-[20px] min-h-0 p-0 border-0 rounded-none bg-[transparent] text-[var(--accent)] hover:bg-[var(--selection)]"
        /><span
          class="code-number w-[46px] pr-[12px] text-right shrink-0 text-[var(--muted)] select-none"
          >{{ index + 1 }}</span
        ><code
          class="[font:inherit] pr-[12px] [:where(&)]:font-['Cascadia_Code',_'JetBrains_Mono',_Consolas,_monospace]"
          ><template v-if="tokens[index]"
            ><span
              v-for="(token, i) in tokens[index]"
              :key="i"
              :class="token.classes"
              :style="token.color ? { '--syntax-color': token.color, '--syntax-light-color': token.lightColor } : undefined"
              >{{ token.text }}</span
            ></template
          ><template v-else>{{ line }}</template
          >{{ !line ? " " : "" }}</code
        >
      </div>
    </div>
    <AppTextarea
      class="absolute inset-0 w-full h-full m-0 pt-[12px] pr-[12px] pb-[12px] pl-[46px] bg-[transparent] text-[transparent] [caret-color:#e0e7ff] [-webkit-text-fill-color:transparent] border-0 rounded-none resize-none [font:12px/20px_Consolas,_monospace] whitespace-pre [tab-size:4] [&::selection]:bg-[var(--selection)]"
      v-if="editable"
      ref="input"
      :aria-label="label"
      :value="text"
      spellcheck="false"
      wrap="off"
      @input="emit('update:text', ($event.target as HTMLTextAreaElement).value)"
      @scroll="syncScroll"
    />
  </AppCodeSurface>
</template>
