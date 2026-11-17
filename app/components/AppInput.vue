<script lang="ts">
import {
  h,
  withDirectives,
  vModelDynamic,
  type FunctionalComponent,
  type InputHTMLAttributes,
} from "vue";
type Props = InputHTMLAttributes & {
  modelValue?: unknown;
  modelModifiers?: Record<string, boolean>;
  "onUpdate:modelValue"?: (value: any) => void;
};
const AppInput: FunctionalComponent<Props> = (props, { attrs }) => {
  const element = h("input", {
    ...attrs,
    class: [
      "[:where(&)]:[font:inherit] [:where(&)]:text-[inherit] [:where(&)]:bg-[var(--bg)] [:where(&)]:border-[1px] [:where(&)]:border-solid [:where(&)]:border-[var(--line)] [:where(&)]:rounded-[6px] [:where(&)]:py-[9px] [:where(&)]:px-[10px] [:where(&)]:outline-none [:where(&)]:min-w-0 [:where(&:focus)]:[border-color:var(--accent)] [:where(&:focus)]:shadow-[0_0_0_2px_#8297ec12] [:where(&::placeholder)]:text-[var(--muted)] [:where(&[type='checkbox'])]:[accent-color:var(--accent)]",
      attrs.class,
    ],
  });
  return attrs["onUpdate:modelValue"]
    ? withDirectives(element, [
        [
          vModelDynamic,
          props.modelValue,
          undefined,
          props.modelModifiers ?? {},
        ],
      ])
    : element;
};
AppInput.props = ["modelValue", "modelModifiers"];
AppInput.inheritAttrs = false;
export default AppInput;
</script>
