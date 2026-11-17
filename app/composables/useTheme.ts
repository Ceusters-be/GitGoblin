import { onMounted, onUnmounted, ref, watch } from 'vue';

export const themes = [
  { id: 'daylight', name: 'Daylight', description: 'Soft white · clear contrast' },
  { id: 'midnight', name: 'Midnight', description: 'Quiet charcoal · cool blue' },
  { id: 'system', name: 'System', description: 'Follow your device' },
] as const;
export type Theme = typeof themes[number]['id'];

export function useTheme() {
  const theme = ref<Theme>('system');
  const error = ref('');
  const systemDark = ref(true);
  let media: MediaQueryList | undefined;
  const changed = () => { systemDark.value = media?.matches ?? true; };
  onMounted(() => {
    try {
      const saved = localStorage.getItem('gitgoblin.theme');
      if (themes.some(option => option.id === saved)) theme.value = saved as Theme;
    } catch { /* Use the device theme when storage is unavailable. */ }
    media = window.matchMedia('(prefers-color-scheme: dark)');
    changed();
    media.addEventListener('change', changed);
  });
  onUnmounted(() => media?.removeEventListener('change', changed));
  watch([theme, systemDark], () => {
    document.documentElement.dataset.theme = theme.value === 'system'
      ? systemDark.value ? 'midnight' : 'daylight' : theme.value;
  }, { immediate: true, flush: 'sync' });
  function setTheme(value: Theme) {
    theme.value = value;
    try {
      localStorage.setItem('gitgoblin.theme', value);
      error.value = '';
    } catch {
      error.value = 'Theme applied, but could not save this preference.';
    }
  }
  return { theme, error, setTheme };
}
