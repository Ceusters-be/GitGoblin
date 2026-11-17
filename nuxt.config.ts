import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2026-10-16",
  ssr: false,
  devtools: { enabled: false },
  css: ["~/assets/tailwind.css"],
  app: {
    head: {
      link: [{ rel: "icon", type: "image/png", href: "/icon.png" }],
      htmlAttrs: {
        class:
          "[--bg:#191c22] [--panel:#20242c] [--raised:#282e38] [--hover:#303845] [--line:#394250] [--fg:#e1e6ef] [--fg-secondary:#bac4d3] [--muted:#95a1b4] [--accent:#8ab4ff] [--accent-hover:#a6c6ff] [--blue:var(--accent)] [--on-accent:#14233d] [--selection:#304e78] [--chrome:#15181e] [color-scheme:dark] [--scrim:#070a11b8] [--success:#83c7a4] [--success-bg:#20372e] [--danger:#f0a6a6] [--danger-bg:#3d252c] [--warning:#dfbf75] [--warning-bg:#393221] [--purple:#c4a7ef] [--purple-bg:#302a40] [--green:var(--success)] [--red:var(--danger)] [--syntax-keyword:#c4a7ef] [--syntax-string:#9dc796] [--syntax-number:#e8b888] [--syntax-property:#9ac8e8] [--syntax-function:#e5c07b] [--syntax-type:#64d8c5] data-[theme=daylight]:[color-scheme:light] data-[theme=daylight]:[--bg:#ffffff] data-[theme=daylight]:[--panel:#ffffff] data-[theme=daylight]:[--raised:#f7f8f9] data-[theme=daylight]:[--hover:#e9eaee] data-[theme=daylight]:[--line:#dfe2e8] data-[theme=daylight]:[--fg:#080808] data-[theme=daylight]:[--fg-secondary:#383b42] data-[theme=daylight]:[--muted:#6c707e] data-[theme=daylight]:[--accent:#3574f0] data-[theme=daylight]:[--accent-hover:#2864d7] data-[theme=daylight]:[--on-accent:#ffffff] data-[theme=daylight]:[--selection:#dceaff] data-[theme=daylight]:[--chrome:#e9eaee] data-[theme=daylight]:[--scrim:#17203255] data-[theme=daylight]:[--success:#24713c] data-[theme=daylight]:[--success-bg:#e3f3e7] data-[theme=daylight]:[--danger:#c42b36] data-[theme=daylight]:[--danger-bg:#fce8e8] data-[theme=daylight]:[--warning:#856014] data-[theme=daylight]:[--warning-bg:#fff4d6] data-[theme=daylight]:[--purple:#7947a4] data-[theme=daylight]:[--purple-bg:#f0e7fa] data-[theme=daylight]:[--syntax-keyword:#0000ff] data-[theme=daylight]:[--syntax-string:#067d17] data-[theme=daylight]:[--syntax-number:#1750eb] data-[theme=daylight]:[--syntax-property:#080808] data-[theme=daylight]:[--syntax-function:#7a3e9d] data-[theme=daylight]:[--syntax-type:#267f99] font-[Inter,_'Segoe_UI',_sans-serif] text-[var(--fg)] bg-[var(--bg)] text-[13px] leading-[normal] [font-synthesis:none] [--sidebar:235px] [--titlebar-height:46px] [--review-heading-height:42px] [&_*]:box-border [&_svg]:shrink-0 [&_body]:m-0 [&_*::selection]:bg-[#6c81c650] [&_*::-webkit-scrollbar]:w-[8px] [&_*::-webkit-scrollbar]:h-[8px] [&_*::-webkit-scrollbar-thumb]:bg-[#30333d] [&_*::-webkit-scrollbar-thumb]:border-[2px] [&_*::-webkit-scrollbar-thumb]:border-solid [&_*::-webkit-scrollbar-thumb]:border-[transparent] [&_*::-webkit-scrollbar-thumb]:[background-clip:padding-box] [&_*::-webkit-scrollbar-thumb]:rounded-[6px] [&_*::-webkit-scrollbar-track]:bg-[transparent] [@media(min-width:1650px)]:[--sidebar:250px] [@media(max-width:1250px)]:[--sidebar:205px] [@media(max-width:1000px)]:[--sidebar:190px] [@media(prefers-reduced-motion:reduce)]:[&_*]:animate-none! [@media(prefers-reduced-motion:reduce)]:[&_*]:[transition:none]! [&_body:has(.pane-resize.dragging)]:cursor-col-resize! [&_body:has(.pane-resize.dragging)]:select-none! [&_body:has(.pane-resize.dragging)_*]:cursor-col-resize! [&_body:has(.pane-resize.dragging)_*]:select-none! [&_body:has(.pane-resize.horizontal.dragging)]:cursor-row-resize! [&_body:has(.pane-resize.horizontal.dragging)_*]:cursor-row-resize!",
      },
      title: process.env.NODE_ENV === "development" ? "GitGoblin (development)" : "GitGoblin",
      meta: [
        {
          name: "description",
          content: "Your code. Your history. Your agents.",
        },
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
    clearScreen: false,
    server: { strictPort: true },
  },
  nitro: { preset: "static" },
});
