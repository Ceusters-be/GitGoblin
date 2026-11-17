<script lang="ts">
import {
  h,
  withDirectives,
  vModelText,
  type FunctionalComponent,
  type TextareaHTMLAttributes,
} from "vue";
type Props = TextareaHTMLAttributes & {
  modelValue?: unknown;
  modelModifiers?: Record<string, boolean>;
  "onUpdate:modelValue"?: (value: any) => void;
};
const AppTextarea: FunctionalComponent<Props> = (props, { attrs }) => {
  const element = h("textarea", {
    ...attrs,
    class: [
      "[:where(&)]:[font:inherit] [:where(&)]:text-[inherit] [:where(&)]:bg-[var(--bg)] [:where(&)]:border-[1px] [:where(&)]:border-solid [:where(&)]:border-[var(--line)] [:where(&)]:rounded-[6px] [:where(&)]:py-[9px] [:where(&)]:px-[10px] [:where(&)]:outline-none [:where(&)]:min-w-0 [:where(&:focus)]:[border-color:var(--accent)] [:where(&:focus)]:shadow-[0_0_0_2px_#8ab4ff20] [:where(&)]:resize-y [:where(&)]:leading-[1.6] [:where(&::placeholder)]:text-[var(--muted)]",
      attrs.class,
    ],
  });
  return attrs["onUpdate:modelValue"]
    ? withDirectives(element, [
        [vModelText, props.modelValue, undefined, props.modelModifiers ?? {}],
      ])
    : element;
};
AppTextarea.props = ["modelValue", "modelModifiers"];
AppTextarea.inheritAttrs = false;
export default AppTextarea;
</script>
