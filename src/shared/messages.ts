import type { ExtensionSettings } from './types';
import type { PlaybackState } from '../audio/types';
import type { LayoutPreferences } from './layout';
import type { PlayerCommand } from './shortcuts';
import type { AccentCache } from './accent';

export const BRIDGE_SOURCE = 'claude-audio-controls-settings-bridge' as const;
export type BridgeMessage = { source: typeof BRIDGE_SOURCE } & (
  | { type: 'CLAUDE_RA_SETTINGS_REQUEST' }
  | { type: 'CLAUDE_RA_SETTINGS_UPDATE'; settings: ExtensionSettings; shortcut: string; commands: Partial<Record<PlayerCommand, string>> }
  | { type: 'CLAUDE_RA_COMMAND'; command: PlayerCommand }
  | { type: 'CLAUDE_RA_LAYOUT_REQUEST' }
  | { type: 'CLAUDE_RA_LAYOUT_UPDATE'; layout: LayoutPreferences }
  | { type: 'CLAUDE_RA_LAYOUT_SAVE'; id: string; layout: LayoutPreferences }
  | { type: 'CLAUDE_RA_LAYOUT_SAVED'; id: string; ok: boolean }
  | { type: 'CLAUDE_RA_THEME_UPDATE'; theme: AccentCache }
  | { type: 'CLAUDE_RA_OPEN_SETTINGS' }
);
export type StateMessage = { type: 'CLAUDE_RA_STATE'; state: PlaybackState };
type WithoutSource<T> = T extends unknown ? Omit<T, 'source'> : never;

/** Outbound types are checked here; receivers still validate untrusted page input. */
export function postBridge(message: WithoutSource<BridgeMessage>): void {
  window.postMessage({ source: BRIDGE_SOURCE, ...message }, location.origin);
}
