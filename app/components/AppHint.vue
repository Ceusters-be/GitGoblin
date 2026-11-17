<script lang="ts">
import { h, type FunctionalComponent, type HTMLAttributes } from "vue";
const AppHint: FunctionalComponent<
  HTMLAttributes & { kind?: "navigation" | "conversation" }
> = ({ kind }, { attrs, slots }) =>
  h(
    "p",
    {
      ...attrs,
      class: [
        kind === "conversation"
          ? "mt-[7px] mx-0 mb-0 text-[11px] leading-[1.5] text-[var(--muted)]"
          : "text-[11px] leading-[1.7] text-[var(--muted)] py-[5px] px-[14px]",
        attrs.class,
      ],
    },
    slots.default?.(),
  );
AppHint.props = ["kind"];
AppHint.inheritAttrs = false;
export default AppHint;
</script>
