import { postBridge } from '../shared/messages';
import { ACCENT_CACHE_KEY, readAccentCache } from '../shared/accent';
import { isLayout, readLayout, writeLayout, LAYOUT_KEY } from '../shared/layout';
import { getSettings, saveSettings, getStoredSettings } from "../shared/storage";
import { VISIBILITY_COMMAND, isPlayerCommand } from "../shared/shortcuts";
import { DEFAULT_SETTINGS, SETTING_STORAGE_KEYS, STORAGE_KEYS } from "../shared/constants";
import { ExtensionSettings } from "../shared/types";
import { ENGAGEMENT_KEY, isEngagementAction } from '../shared/engagement';

const BRIDGE_SOURCE = "claude-audio-controls-settings-bridge";
const REQUEST_TYPE = "CLAUDE_RA_SETTINGS_REQUEST";
const UPDATE_TYPE = "CLAUDE_RA_SETTINGS_UPDATE";
const THEME_UPDATE_TYPE = "CLAUDE_RA_THEME_UPDATE";
const CLAUDE_THEME_KEYS = new Set(["blue", "green", "purple", "orange", "pink", "yellow", "black"]);
const settingEntries = Object.entries(SETTING_STORAGE_KEYS) as [keyof ExtensionSettings, string][];
const settingStorageKeyNames = settingEntries.map(([, storageKey]) => storageKey);

// Reloading/updating an extension invalidates bridges in already-open tabs.
// Chrome APIs can throw synchronously before returning a Promise in that state.
function bridgeAvailable(): boolean {
  try { return Boolean(chrome.runtime?.id); } catch { return false; }
}
function extensionCall<T>(operation: () => Promise<T>): Promise<T> {
  return Promise.resolve().then(operation);
}

function publish(settings: ExtensionSettings, shortcut = '', commands: Record<string, string> = {}): void {
  if (!bridgeAvailable()) return;
  postBridge({ type: UPDATE_TYPE, settings, shortcut, commands });
}

async function readSettings(): Promise<void> {
  if (!bridgeAvailable()) return;
  try {
    const stored = await chrome.storage.sync.get([STORAGE_KEYS.SETTINGS, ...settingStorageKeyNames]);
    const command = await chrome.runtime.sendMessage({ type: 'get-visibility-shortcut' }).catch(() => null);
    publish(getStoredSettings(stored), typeof command?.shortcut === 'string' ? command.shortcut : '', command?.commands || {});
  } catch (_) {
    publish(DEFAULT_SETTINGS);
  }
}

window.addEventListener("message", (event: MessageEvent) => {
  if (!bridgeAvailable() || event.origin !== location.origin) return;
  if (event.source === window && event.data?.source === 'claude-audio-controls-engagement' && event.data.type === 'request' && typeof event.data.id === 'string' && event.data.id.length <= 64 && isEngagementAction(event.data.action)) {
    const { id, action } = event.data;
    const result = (reply: any) => window.postMessage({ source: 'claude-audio-controls-engagement', type: 'result', id, ...reply }, location.origin);
    if (action.type === 'claim' && document.visibilityState !== 'visible') result({ ok: false });
    else void extensionCall(() => chrome.runtime.sendMessage({ type: 'engagement', action })).then(result).catch(() => result({ ok: false }));
  }
  if (event.source === window && event.data?.source === BRIDGE_SOURCE) {
    if (event.data.type === 'CLAUDE_RA_LAYOUT_REQUEST') void publishLayout();
    if (event.data.type === 'CLAUDE_RA_LAYOUT_SAVE' && typeof event.data.id === 'string' && event.data.id.length < 100) {
      const { id, layout } = event.data;
      void (async () => {
        let ok = false;
        try { if (isLayout(layout)) { await writeLayout(layout); ok = true; await publishLayout(); } } catch {}
        window.postMessage({ source: BRIDGE_SOURCE, type: 'CLAUDE_RA_LAYOUT_SAVED', id, ok }, location.origin);
      })();
    }
    if (event.data.type === 'CLAUDE_RA_OPEN_SETTINGS') void extensionCall(() => chrome.runtime.sendMessage({ type: 'open-settings' })).catch(() => {});
  }
  if (
    event.source === window &&
    event.data?.source === BRIDGE_SOURCE &&
    event.data?.type === REQUEST_TYPE
  ) {
    void readSettings();
  }

  if (
    event.source === window &&
    event.data?.source === BRIDGE_SOURCE &&
    event.data?.type === THEME_UPDATE_TYPE &&
    event.data?.theme &&
    CLAUDE_THEME_KEYS.has(event.data.theme.chatTheme) &&
    typeof event.data.theme.isDark === "boolean" &&
    typeof event.data.theme.updatedAt === "number"
  ) {
    const theme = readAccentCache(event.data.theme);
    if (theme) void extensionCall(() => chrome.storage.local.set({ [ACCENT_CACHE_KEY]: theme })).catch(() => {});
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (!bridgeAvailable()) return;
  if (areaName === 'local' && changes[ENGAGEMENT_KEY]) window.postMessage({ source: 'claude-audio-controls-engagement', type: 'changed' }, location.origin);
  if (areaName === 'local' && changes[LAYOUT_KEY]) void publishLayout();
  if (areaName !== "sync") return;

  if (
    !changes[STORAGE_KEYS.SETTINGS] &&
    !settingStorageKeyNames.some((storageKey) => changes[storageKey])
  ) return;

  void readSettings();
});

void readSettings();
window.addEventListener('focus', () => { void readSettings(); });

// Only the extension service worker can request a persistent visibility change.
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!bridgeAvailable() || sender.id !== chrome.runtime.id || !isPlayerCommand(message?.type)) return;
  void getSettings().then(async settings => {
    const focused = document.activeElement;
    const typing = focused instanceof HTMLElement && (focused.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName));
    if (settings.enableShortcuts && !typing) {
      if (message.type === VISIBILITY_COMMAND) await saveSettings({ floatingUiHidden: !settings.floatingUiHidden });
      else window.postMessage({ source: BRIDGE_SOURCE, type: 'CLAUDE_RA_COMMAND', command: message.type }, location.origin);
    }
    reply({ ok: true });
  }).catch(() => reply({ ok: false }));
  return true;
});

async function publishLayout(): Promise<void> {
  if (!bridgeAvailable()) return;
  try { window.postMessage({ source: BRIDGE_SOURCE, type: 'CLAUDE_RA_LAYOUT_UPDATE', layout: await readLayout() }, location.origin); } catch {}
}
