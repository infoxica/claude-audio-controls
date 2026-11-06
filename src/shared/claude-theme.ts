export interface ThemeSnapshot {
  mode: 'light' | 'dark';
  background: string; surface: string; text: string; muted: string; border: string; accent: string; accentText: string;
}
let colorProbe: HTMLSpanElement | null = null;
export function readClaudeTheme(element: HTMLElement = document.documentElement): ThemeSnapshot {
  const mode: ThemeSnapshot['mode'] = (element.closest('[data-mode]')?.getAttribute('data-mode') || document.documentElement.dataset.mode) === 'light' ? 'light' : 'dark';
  const fallback = mode === 'light'
    ? { background: '#faf9f5', surface: '#f0eee6', text: '#252522', muted: '#66645f', border: '#d9d7d0', accent: '#c6613f', accentText: '#ffffff' }
    : { background: '#191919', surface: '#2d2d2d', text: '#eeeeee', muted: '#aaaaaa', border: '#3b3b3b', accent: '#d97757', accentText: '#ffffff' };
  const style = getComputedStyle(element);
  const probe = colorProbe ||= document.createElement('span'); probe.hidden = true;
  if (probe.parentElement !== element) element.append(probe);
  const color = (token: string, defaultValue: string) => {
    const raw = style.getPropertyValue(token).trim();
    if (!raw || !CSS.supports('color', raw)) return defaultValue;
    probe.style.color = raw;
    const resolved = getComputedStyle(probe).color;
    return resolved && resolved !== 'rgba(0, 0, 0, 0)' ? resolved : defaultValue;
  };
  const theme = { mode, background: color('--cds-page-bg', fallback.background), surface: color('--cds-fill-control', fallback.surface),
    text: color('--cds-text-primary', fallback.text), muted: color('--cds-text-secondary', fallback.muted),
    border: color('--cds-border-line', fallback.border), accent: color(mode === 'light' ? '--cds-clay-emphasized' : '--cds-clay', fallback.accent), accentText: color('--cds-on-accent', fallback.accentText) };
  return theme;
}
