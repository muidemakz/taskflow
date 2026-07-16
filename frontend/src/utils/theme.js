const STORAGE_KEY = 'taskflow_theme';
const THEMES = ['light', 'dark', 'system'];

export function getStoredTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return THEMES.includes(stored) ? stored : 'system';
}

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// `dark` drives Tailwind's dark: utility variant; the theme-* class is a
// plain hook for any CSS that needs to know the raw preference (not just
// the resolved light/dark) -- e.g. showing which option is active.
export function applyTheme(theme) {
  const pref = THEMES.includes(theme) ? theme : 'system';
  const effectiveDark = pref === 'dark' || (pref === 'system' && systemPrefersDark());
  const root = document.documentElement;
  root.classList.toggle('dark', effectiveDark);
  root.classList.remove('theme-light', 'theme-dark', 'theme-system');
  root.classList.add(`theme-${pref}`);
  localStorage.setItem(STORAGE_KEY, pref);
}

// Registered once from App.jsx. Only re-applies when the user's saved
// preference is "system" -- an explicit light/dark choice should not move
// just because the OS setting changed.
export function watchSystemTheme() {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (getStoredTheme() === 'system') applyTheme('system');
  };
  media.addEventListener('change', handler);
  return () => media.removeEventListener('change', handler);
}
