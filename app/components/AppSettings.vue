<script setup lang="ts">
import { Keyboard, Palette, X } from 'lucide-vue-next';
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from 'reka-ui';
import { themes, type Theme } from '~/composables/useTheme';
defineProps<{ theme: Theme; error: string }>();
defineEmits<{ close: []; theme: [value: Theme] }>();
</script>

<template>
  <AppDialog title="Settings" @close="$emit('close')">
    <AppDialogPanel class="settings-modal w-[820px] max-w-[calc(100vw-32px)] h-[460px] max-h-[calc(100dvh-32px)] flex flex-col overflow-hidden">
      <header class="settings-heading flex items-center justify-between py-[16px] px-[20px] border-b border-[var(--line)] [&_h2]:m-0 [&_h2]:text-[18px] [&_h2]:font-semibold [&_h2]:tracking-[-.3px]">
        <h2>Settings</h2>
        <AppButton size="icon" aria-label="Close settings" @click="$emit('close')"><X :size="18" /></AppButton>
      </header>
      <TabsRoot default-value="appearance" orientation="vertical" class="settings-layout flex flex-1 min-h-0">
        <TabsList class="settings-nav flex flex-col gap-[4px] basis-[170px] shrink-0 grow-0 py-[12px] px-[8px] bg-[var(--raised)] border-r border-[var(--line)] [&>button]:justify-start [&>button]:p-[10px] [&>button]:text-[var(--fg-secondary)] [&>button[data-state=active]]:bg-[var(--selection)] [&>button[data-state=active]]:text-[var(--fg)] [@media(max-width:650px)]:basis-[135px]" aria-label="Settings categories">
          <TabsTrigger value="appearance" as-child><AppButton><Palette :size="16" />Appearance</AppButton></TabsTrigger>
          <TabsTrigger value="shortcuts" as-child><AppButton><Keyboard :size="16" />Shortcuts</AppButton></TabsTrigger>
        </TabsList>
        <div class="settings-content flex-1 min-w-0 p-[24px] overflow-auto [&_h3]:mt-0 [&_h3]:mx-0 [&_h3]:mb-[12px] [&_h3]:text-[16px] [&_h3]:font-medium [&_p]:text-[var(--muted)] [&_p]:text-[12px] [&_p]:leading-[1.7] [&_p]:mt-0 [&_p]:mx-0 [&_p]:mb-[18px] [&_[role=alert]]:text-[var(--danger)] [@media(max-width:650px)]:p-[16px]">
          <TabsContent value="appearance">
            <h3>Appearance</h3>
            <p>Choose how GitGoblin looks on this device.</p>
            <div class="theme-options grid grid-cols-3 gap-[8px] mb-[18px] [@media(max-width:650px)]:grid-cols-1" role="group" aria-label="Theme">
              <AppButton v-for="option in themes" :key="option.id" class="theme-option flex items-stretch flex-col p-[10px] border border-[var(--line)] text-left gap-[6px] bg-[var(--bg)] whitespace-normal min-w-0 aria-pressed:border-[var(--accent)] aria-pressed:shadow-[inset_0_0_0_1px_var(--accent)] [&_strong]:text-[12px] [&_strong]:font-semibold [&_small]:text-[var(--muted)] [&_small]:text-[10px] [&_small]:leading-[1.5]"
                :aria-label="option.name" :aria-pressed="theme === option.id" @click="$emit('theme', option.id)">
                <span class="theme-preview flex h-[64px] gap-[8px] rounded-[4px] bg-[image:var(--preview-bg)] mb-[4px] overflow-hidden [&_i]:w-[24%] [&_i]:bg-[var(--preview-panel)] [&>span]:flex [&>span]:flex-col [&>span]:justify-center [&>span]:gap-[6px] [&>span]:flex-1 [&_b]:w-[65%] [&_b]:h-[3px] [&_b]:bg-[var(--preview-line)] [&_b]:rounded-[2px] [&_b:first-child]:w-[45%] [&_b:first-child]:bg-[var(--preview-accent)] data-[palette=daylight]:[--preview-bg:linear-gradient(#e9eaee,#e9eaee)] data-[palette=daylight]:[--preview-panel:#fff] data-[palette=daylight]:[--preview-line:#6c707e] data-[palette=daylight]:[--preview-accent:#3574f0] data-[palette=midnight]:[--preview-bg:linear-gradient(#191c22,#191c22)] data-[palette=midnight]:[--preview-panel:#282e38] data-[palette=midnight]:[--preview-line:#95a1b4] data-[palette=midnight]:[--preview-accent:#8ab4ff] data-[palette=system]:[--preview-bg:linear-gradient(90deg,#e9eaee_50%,#191c22_50%)] data-[palette=system]:[--preview-panel:#bac4d3] data-[palette=system]:[--preview-line:#8b97ab] data-[palette=system]:[--preview-accent:#3574f0]" :data-palette="option.id" aria-hidden="true"><i /><span><b /><b /><b /></span></span>
                <strong>{{ option.name }}</strong><small>{{ option.description }}</small>
              </AppButton>
            </div>
            <p>Applied immediately across the workspace and remembered on this device.</p>
            <p v-if="error" role="alert">{{ error }}</p>
          </TabsContent>
          <TabsContent value="shortcuts">
            <h3>Keyboard shortcuts</h3>
            <dl class="settings-shortcuts m-0 [&>div]:flex [&>div]:justify-between [&>div]:items-center [&>div]:gap-[12px] [&>div]:py-[12px] [&>div]:border-b [&>div]:border-[var(--line)] [&>div]:text-[12px] [&_dd]:m-0 [&_dd]:shrink-0 [&_kbd]:py-[4px] [&_kbd]:px-[6px] [&_kbd]:border [&_kbd]:border-[var(--line)] [&_kbd]:rounded-[4px] [&_kbd]:bg-[var(--raised)] [&_kbd]:text-[var(--fg-secondary)] [&_kbd]:text-[11px] [@media(max-width:650px)]:[&>div]:flex-wrap">
              <div><dt>Open repository</dt><dd><kbd>Ctrl + O</kbd></dd></div>
              <div><dt>Refresh repository</dt><dd><kbd>Ctrl + R</kbd></dd></div>
              <div><dt>Settings</dt><dd><kbd>Ctrl / ⌘ + ,</kbd></dd></div>
              <div><dt>Commit from the message field</dt><dd><kbd>Ctrl / ⌘ + Enter</kbd></dd></div>
              <div><dt>Close dialog</dt><dd><kbd>Esc</kbd></dd></div>
            </dl>
          </TabsContent>
        </div>
      </TabsRoot>
    </AppDialogPanel>
  </AppDialog>
</template>
