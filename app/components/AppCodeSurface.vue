<script lang="ts">
import { h, type FunctionalComponent, type HTMLAttributes } from "vue";

const AppCodeSurface: FunctionalComponent<HTMLAttributes> = (
  props,
  { attrs, slots },
) =>
  h(
    "div",
    {
      ...attrs,
      class: [
        "[&_.syntax-token]:text-[var(--syntax-color)] [[data-theme=daylight]_&_.syntax-token]:text-[var(--syntax-light-color,var(--fg))] [[data-theme=daylight]_&_.syntax-token]:text-[var(--syntax-light-color,var(--fg))] [&_.hljs-comment]:text-[var(--muted)] [&_.hljs-quote]:text-[var(--muted)] [&_.hljs-keyword]:text-[var(--syntax-keyword)] [&_.hljs-selector-tag]:text-[var(--syntax-keyword)] [&_.hljs-literal]:text-[var(--syntax-keyword)] [&_.hljs-string]:text-[var(--syntax-string)] [&_.hljs-regexp]:text-[var(--syntax-string)] [&_.hljs-addition]:text-[var(--syntax-string)] [&_.hljs-number]:text-[var(--syntax-number)] [&_.hljs-symbol]:text-[var(--syntax-number)] [&_.hljs-bullet]:text-[var(--syntax-number)] [&_.hljs-title]:text-[var(--syntax-function)] [&_.hljs-section]:text-[var(--syntax-function)] [&_.hljs-type]:text-[var(--syntax-type)] [&_.hljs-built\\_in]:text-[var(--syntax-type)] [&_.hljs-name]:text-[var(--syntax-type)] [&_.hljs-attr]:text-[var(--syntax-property)] [&_.hljs-attribute]:text-[var(--syntax-property)] [&_.hljs-variable]:text-[var(--syntax-property)] [&_.hljs-selector-class]:text-[var(--syntax-property)] [&_.hljs-meta]:text-[var(--syntax-keyword)] [&_.hljs-doctag]:text-[var(--syntax-keyword)]",
        attrs.class,
      ],
    },
    slots.default?.(),
  );

AppCodeSurface.inheritAttrs = false;
export default AppCodeSurface;
</script>
