<script lang="ts">
import { h, type FunctionalComponent, type HTMLAttributes } from "vue";

const AppDialogFooter: FunctionalComponent<HTMLAttributes> = (
  props,
  { attrs, slots },
) =>
  h(
    "div",
    {
      ...attrs,
      class: [
        "flex justify-end items-center gap-[8px] mt-[22px] border-t-[1px] border-solid border-t-[var(--line)] pt-[16px] text-[12px] [&>span]:mr-auto [&>span]:text-[var(--muted)] [&>span]:text-[11px]",
        attrs.class,
      ],
    },
    slots.default?.(),
  );

AppDialogFooter.inheritAttrs = false;
export default AppDialogFooter;
</script>
