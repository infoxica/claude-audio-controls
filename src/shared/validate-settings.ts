import { DEFAULT_SETTINGS, SUPPORTED_LANGUAGES } from './constants';
import type { ExtensionSettings } from './types';

const languages = new Set(SUPPORTED_LANGUAGES.map(item => item.code));
/** Treat storage and page messages as untrusted input; omit invalid partial updates. */
export function validSettings(input: unknown): Partial<ExtensionSettings> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(DEFAULT_SETTINGS, key)) continue;
    let valid = false;
    if (['notifyDownloadReady', 'floatingUiHidden', 'enableShortcuts', 'smoothScrubbing'].includes(key)) valid = typeof value === 'boolean';
    if (key === 'defaultSpeed') valid = typeof value === 'number' && Number.isFinite(value) && value >= 0.5 && value <= 3;
    if (key === 'defaultVolume') valid = typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
    if (key === 'tapSeekSeconds') valid = typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 120;
    if (key === 'floatingUiHideMode') valid = value === 'idle-only' || value === 'all';
    if (key === 'theme') valid = value === 'system' || value === 'light' || value === 'dark';
    if (key === 'autoDownloadFormat') valid = value === 'auto';
    if (key === 'language') valid = typeof value === 'string' && languages.has(value as ExtensionSettings['language']);
    if (valid) output[key] = value;
  }
  return output as Partial<ExtensionSettings>;
}

export function normalizedSettings(input: unknown): ExtensionSettings {
  return { ...DEFAULT_SETTINGS, ...validSettings(input) };
}
