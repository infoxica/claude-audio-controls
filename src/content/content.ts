import type { StateMessage } from '../shared/messages';
import { normalizedSettings } from '../shared/validate-settings';
import { readClaudeTheme } from "../shared/claude-theme";
import { literalColor } from '../shared/accent';
import { openStandaloneSettings } from './standalone-settings';
import { PlayerLayout } from './player-layout';
import { ReadyToast } from './ready-toast';
import { SupportPrompts } from './support-prompts';
import { featureCopy, commandLabels } from '../shared/i18n/features';
import { polishCopy } from '../shared/i18n/polish';
import { languageDirection, resolveLanguage } from '../shared/i18n/core';
import { COMMANDS, isPlayerCommand, matchesShortcut, PlayerCommand } from '../shared/shortcuts';
import { ClaudePlayback } from "../audio/claude-capture";
import { getReleaseCopy } from "../shared/i18n/release-copy";
import { floatingVisibility } from "../shared/visibility";
import { playbackAction, platformKeys } from "../shared/shortcuts";
import { getLucideSvg, setIcon } from "./icons";
import { SPEED_PRESETS, STORAGE_KEYS, DEFAULT_SETTINGS } from "../shared/constants";
import { ExtensionSettings } from "../shared/types";
import { getTranslations } from "../shared/i18n/core";

declare const __USERSCRIPT__: boolean;
const standalone = typeof __USERSCRIPT__ !== 'undefined' && __USERSCRIPT__;
(function () {
  "use strict";
  if (window.top !== window || (window as any).__CLAUDE_RA_INSTALLED__) return;
  (window as any).__CLAUDE_RA_INSTALLED__ = true;

  const PAGE: any = typeof window !== "undefined" ? window : globalThis;

  const CONFIG = {
    tapSeekSeconds: 10,
    speeds: SPEED_PRESETS,
    defaultSpeed: 1,
    defaultVolume: 1,
    speedStorage: STORAGE_KEYS.SPEED,
    volumeStorage: STORAGE_KEYS.VOLUME,
    settingsStorage: STORAGE_KEYS.SETTINGS,
    debug: false,
  };

  const CLAUDE_THEME_KEYS = ["blue", "green", "purple", "orange", "pink", "yellow", "black"];

  let activeMedia: HTMLMediaElement | null = null;
  let settingsCache: ExtensionSettings | null = null;
  let commandBindings: Record<string, string> = {};
  let playerLayout: PlayerLayout | null = null;
  const readyToast = new ReadyToast();
  if (standalone) { try { settingsCache = normalizedSettings(JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}')); } catch { settingsCache = { ...DEFAULT_SETTINGS }; } }
  let sessionSpeed: number | null = null;
  let sessionVolume: number | null = null;
  const mediaListenersInstalled = new WeakSet<HTMLMediaElement>();
  let userForcedExpand = false;
  let userForcedCollapsed = false;

  let leftRail: HTMLElement | null = null;
  let rightRail: HTMLElement | null = null;
  let floatingToggle: HTMLButtonElement | null = null;
  let seekSlider: HTMLInputElement | null = null;
  let currentLabel: HTMLElement | null = null;
  let durationLabel: HTMLElement | null = null;
  let playButton: HTMLElement | null = null;
  let speedButton: HTMLElement | null = null;
  let speedMenu: HTMLElement | null = null;
  let volumeWrap: HTMLElement | null = null;
  let volumeSlider: HTMLInputElement | null = null;
  let volumeLabel: HTMLElement | null = null;
  let downloadButton: HTMLElement | null = null;

  let sliderDragging = false;


  // Cached DOM state to completely eliminate flickering and redundant reflows
  const cache = {
    currentTimeStr: "",
    durationStr: "",
    isPaused: true,
    speed: 1,
    volume: 1,
    isMuted: false,
    controlsEnabled: false,
    leftWidth: "",
    leftX: "",
    leftY: "",
    rightX: "",
    rightY: "",
    isCollapsed: true,
    floatingHidden: false,
    lastBroadcast: 0,
    lastThemeCheck: "",
  };

  function log(...args: any[]) {
    if (CONFIG.debug) {
      console.log(
        "%c[Claude Audio Controls]",
        "color:#3968c8;font-weight:700",
        ...args,
      );
    }
  }

  function warn(...args: any[]) {
    console.warn("[Claude Audio Controls]", ...args);
  }

  let statusTimer = 0;
  function showStatus(message: string, error = false): void {
    let status = document.getElementById('claude-ra-status');
    if (!status) { status = document.createElement('div'); status.id = 'claude-ra-status'; status.setAttribute('role', 'status'); document.body.append(status); }
    status.dir = languageDirection(settingsCache?.language);
    status.lang = resolveLanguage(settingsCache?.language);
    status.textContent = message;
    status.hidden = false;
    status.dataset.error = String(error);
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => { if (status) status.hidden = true; }, error ? 12000 : 4000);
  }
  function recoveryCopy() { return getReleaseCopy(settingsCache?.language); }

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

    const total = Math.floor(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    return `${minutes}:${String(secs).padStart(2, "0")}`;
  }

  function getSavedSpeed(): number {
    if (sessionSpeed !== null) return sessionSpeed;

    // Standalone playback restores the last player choice before settings defaults.
    if (standalone) {
      try {
        const saved = parseFloat(localStorage.getItem(CONFIG.speedStorage) || "");
        if (Number.isFinite(saved) && saved >= 0.5 && saved <= 3) return saved;
      } catch (_) {}
    }

    const configuredSpeed = Number(settingsCache?.defaultSpeed);
    if (Number.isFinite(configuredSpeed) && configuredSpeed >= 0.5 && configuredSpeed <= 3) {
      return configuredSpeed;
    }

    const n = parseFloat(localStorage.getItem(CONFIG.speedStorage) || "");
    return Number.isFinite(n) && n >= 0.5 && n <= 3 ? n : CONFIG.defaultSpeed;
  }

  function getSavedVolume(): number {
    if (sessionVolume !== null) return sessionVolume;

    if (standalone) {
      try {
        const saved = parseFloat(localStorage.getItem(CONFIG.volumeStorage) || "");
        if (Number.isFinite(saved) && saved >= 0 && saved <= 1) return saved;
      } catch (_) {}
    }

    const configuredVolume = Number(settingsCache?.defaultVolume);
    if (Number.isFinite(configuredVolume) && configuredVolume >= 0 && configuredVolume <= 1) {
      return configuredVolume;
    }

    const n = parseFloat(localStorage.getItem(CONFIG.volumeStorage) || "");
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : CONFIG.defaultVolume;
  }

  function getSavedSettings(): Partial<ExtensionSettings> {
    if (settingsCache) return settingsCache;

    try {
      const raw = localStorage.getItem(CONFIG.settingsStorage);
      return normalizedSettings(raw ? JSON.parse(raw) : {});
    } catch (_) {
      return {};
    }
  }

  function getI18n() {
    return getTranslations(settingsCache?.language);
  }

  function applyI18nLabels(): void {
    const t = getI18n();
    const settings = getSavedSettings();
    const step = settings.tapSeekSeconds || CONFIG.tapSeekSeconds;

    seekSlider?.setAttribute('aria-label', polishCopy(settingsCache?.language).seekPosition);

    for (const el of [leftRail, rightRail, floatingToggle]) if (el) { el.dir = languageDirection(settingsCache?.language); el.lang = resolveLanguage(settingsCache?.language); }
    if (floatingToggle) {
      floatingToggle.title = t.common.extensionName;
      floatingToggle.setAttribute("aria-label", t.content.tooltips.expand);
    }

    if (rightRail) {
      const backBtn = rightRail.querySelector<HTMLElement>(".claude-ra-back");
      if (backBtn) backBtn.title = t.content.tooltips.back.replace("{s}", String(step));

      const playBtn = rightRail.querySelector<HTMLElement>(".claude-ra-play");
      if (playBtn) { playBtn.title = platformKeys(t.content.tooltips.playPause); playBtn.dataset.defaultTitle = playBtn.title; }

      const forwardBtn = rightRail.querySelector<HTMLElement>(".claude-ra-forward");
      if (forwardBtn) forwardBtn.title = t.content.tooltips.forward.replace("{s}", String(step));

      const speedBtn = rightRail.querySelector<HTMLElement>(".claude-ra-speed-btn");
      if (speedBtn) speedBtn.title = t.content.tooltips.speed;

      const volBtn = rightRail.querySelector<HTMLElement>(".claude-ra-volume-btn");
      if (volBtn) volBtn.title = t.content.tooltips.volume;

      const volSlider = rightRail.querySelector<HTMLInputElement>(".claude-ra-volume-slider");
      if (volSlider) volSlider.setAttribute("aria-label", t.content.tooltips.volumeSlider);

      const dlBtn = rightRail.querySelector<HTMLElement>(".claude-ra-download");
      if (dlBtn) dlBtn.title = t.content.tooltips.download;

      const helpBtn = rightRail.querySelector<HTMLElement>(".claude-ra-help-wrap .claude-ra-icon-btn");
      if (helpBtn) helpBtn.title = t.content.tooltips.shortcuts;

      const helpPopover = rightRail.querySelector<HTMLElement>(".claude-ra-popover.claude-ra-help");
      if (helpPopover) {
        helpPopover.innerHTML = `
          <div class="claude-ra-help-title">${t.content.shortcutsPopover.title}</div>
          <div class="claude-ra-shortcut-row">
            <span>${t.content.shortcutsPopover.playPause}</span>
            <span class="claude-ra-shortcut-key">Space / K</span>
          </div>
          <div class="claude-ra-shortcut-row">
            <span>${t.content.shortcutsPopover.back.replace("{s}", String(step))}</span>
            <span class="claude-ra-shortcut-key">${platformKeys("Alt")} + ←</span>
          </div>
          <div class="claude-ra-shortcut-row">
            <span>${t.content.shortcutsPopover.forward.replace("{s}", String(step))}</span>
            <span class="claude-ra-shortcut-key">${platformKeys("Alt")} + →</span>
          </div>
          <div class="claude-ra-shortcut-row">
            <span>${t.content.shortcutsPopover.slower}</span>
            <span class="claude-ra-shortcut-key">${platformKeys("Shift")} + ,</span>
          </div>
          <div class="claude-ra-shortcut-row">
            <span>${t.content.shortcutsPopover.faster}</span>
            <span class="claude-ra-shortcut-key">${platformKeys("Shift")} + .</span>
          </div>
          <div class="claude-ra-shortcut-row">
            <span>${t.content.shortcutsPopover.volumeScroll}</span>
            <span class="claude-ra-shortcut-key">${t.content.shortcutsPopover.volumeScrollKey}</span>
          </div>
          <div class="claude-ra-shortcut-row">
            <span>${t.content.shortcutsPopover.smoothScrub}</span>
            <span class="claude-ra-shortcut-key">${t.content.shortcutsPopover.smoothScrubKey.replace(/{s}/g, String(step))}</span>
          </div>
        `;
        const labels = commandLabels(settingsCache?.language, step);
        for (const command of COMMANDS) {
          const commandRow = document.createElement('div'); commandRow.className = 'claude-ra-shortcut-row';
          const label = document.createElement('span'); label.textContent = labels[command].replace('{s}', String(step));
          const key = document.createElement('span'); key.className = 'claude-ra-shortcut-key'; key.textContent = commandBindings[command] ? platformKeys(commandBindings[command]) : recoveryCopy().unassigned;
          commandRow.append(label, key); helpPopover.append(commandRow);
        }
        const scope = document.createElement('p');
        scope.textContent = /Android/i.test(navigator.userAgent) ? featureCopy(settingsCache?.language).desktopShortcuts : recoveryCopy().shortcutScope;
        helpPopover.append(scope);
        const settingsButton = document.createElement('button'); settingsButton.type = 'button'; settingsButton.textContent = t.popup.header.openOptions; settingsButton.onclick = () => dispatchAction('open-settings'); helpPopover.append(settingsButton);
      }

      const collapseBtn = rightRail.querySelector<HTMLElement>(".claude-ra-collapse-btn");
      if (collapseBtn) collapseBtn.title = t.content.tooltips.collapse;
    }

  }

  function installSettingsBridge(): void {
    window.addEventListener('message', event => {
      const focused = document.activeElement;
      if (event.origin !== location.origin || (focused instanceof HTMLElement && (focused.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName)))) return;
      if (event.source === window && event.data?.source === 'claude-audio-controls-settings-bridge' && event.data?.type === 'CLAUDE_RA_COMMAND' && isPlayerCommand(event.data.command) && getSavedSettings().enableShortcuts !== false) dispatchAction(event.data.command);
    });
    window.addEventListener("message", (event: MessageEvent) => {
  if (event.origin !== location.origin) return;
      if (
        event.source !== window ||
        event.data?.source !== "claude-audio-controls-settings-bridge" ||
        event.data?.type !== "CLAUDE_RA_SETTINGS_UPDATE"
      ) {
        return;
      }

      settingsCache = normalizedSettings(event.data.settings);
      commandBindings = Object.fromEntries(COMMANDS.map(c => [c, typeof event.data.commands?.[c] === 'string' ? event.data.commands[c].slice(0, 80) : '']));
      if (!settingsCache.notifyDownloadReady) readyToast.clear();

      if (activeMedia) {
        try {
          activeMedia.playbackRate = getSavedSpeed();
          activeMedia.defaultPlaybackRate = getSavedSpeed();
          activeMedia.volume = getSavedVolume();
        } catch (_) {}
      }

      applyI18nLabels();
      updateControls();
      scheduleLayoutSync();
    });

    window.postMessage(
      {
        source: "claude-audio-controls-settings-bridge",
        type: "CLAUDE_RA_SETTINGS_REQUEST",
      },
      location.origin,
    );
  }

  // ---------------------------------------------------------------------
  // Intelligent Claude Theme & Accent Detection
  // ---------------------------------------------------------------------

  function activeThemeElements(): HTMLElement[] {
    const elements: HTMLElement[] = [];
    for (let el = getComposer(); el; el = el.parentElement) elements.push(el);
    if (!elements.includes(document.documentElement)) elements.push(document.body, document.documentElement);
    return elements.filter(Boolean);
  }

  function detectAndCacheClaudeTheme(): void {
    if (!document.body) return;
    const theme = readClaudeTheme(getComposer() || document.documentElement);
    const themeKey = JSON.stringify(theme);
    if (cache.lastThemeCheck === themeKey) return;
    cache.lastThemeCheck = themeKey;
    for (const el of [leftRail, rightRail, floatingToggle]) {
      if (!el) continue;
      for (const [name, value] of Object.entries({ bg: theme.background, 'bg-surface': theme.surface, text: theme.text, muted: theme.muted, border: theme.border, accent: theme.accent, 'accent-text': theme.accentText })) el.style.setProperty('--claude-ra-' + name, value);
    }
    const themeCache = { isDark: theme.mode === 'dark', chatTheme: 'blue', accent: theme.accent, accentText: theme.accentText, updatedAt: Date.now() };
    window.postMessage({ source: 'claude-audio-controls-settings-bridge', type: 'CLAUDE_RA_THEME_UPDATE', theme: themeCache }, location.origin);
  }

  function broadcastLiveAudioState(force = false): void {
    const now = Date.now();
    if (!force && now - cache.lastBroadcast < 500) return;
    cache.lastBroadcast = now;

    window.postMessage({ type: 'CLAUDE_RA_STATE', state: playback.state } satisfies StateMessage, location.origin);
  }

  const supportPrompts = new SupportPrompts(() => ({ language: settingsCache?.language, hidden: getSavedSettings().floatingUiHidden === true, composer: getComposer() }));
  const playback = new ClaudePlayback(media => {
    const changed = activeMedia !== media;
    activeMedia = media;
    if (media && changed) {
      media.playbackRate = getSavedSpeed(); media.volume = getSavedVolume();
      installMediaListeners(media); userForcedExpand = true; userForcedCollapsed = false;
    }
    updateControls(); broadcastLiveAudioState(true); scheduleLayoutSync();
  }, _message => showStatus(`${recoveryCopy().playError} ${recoveryCopy().nativeHelp}`, true), ready => {
    readyToast.clear();
    if (ready && getSavedSettings().notifyDownloadReady !== false) readyToast.show(featureCopy(settingsCache?.language).ready, getI18n().content.tooltips.download, recoveryCopy().dismiss, languageDirection(settingsCache?.language), () => void downloadCurrentAudio(), resolveLanguage(settingsCache?.language));
  }, activity => supportPrompts.observe(activity), () => getI18n().content.tooltips.playPause);

  function getSeekInfo(media = activeMedia): { start: number; end: number; seekable: boolean } {
    const state = playback.state;
    return { start: state.buffered.start, end: state.buffered.end, seekable: Boolean(media && state.capabilities.seek) };
  }

  function installMediaListeners(media: HTMLMediaElement): void {
    if (mediaListenersInstalled.has(media)) return;
    mediaListenersInstalled.add(media);

    [
      "loadedmetadata",
      "durationchange",
      "timeupdate",
      "ratechange",
      "volumechange",
      "play",
      "pause",
      "ended",
      "canplay",
    ].forEach((name) => {
      media.addEventListener(name, () => {
        if (activeMedia === media) {
          updateControls();
          broadcastLiveAudioState();
          if (name === "play" || name === "pause" || name === "ended") {
            scheduleLayoutSync();
          }
        }
      });
    });
  }

  // ---------------------------------------------------------------------
  // UI Building
  // ---------------------------------------------------------------------

  function buildUI(): void {
    if (leftRail || !document.body) return;

    floatingToggle = document.createElement("button");
    floatingToggle.id = "claude-ra-floating-toggle";
    floatingToggle.type = "button";
    floatingToggle.innerHTML = getLucideSvg("chevron-up");

    floatingToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCollapsed();
    });

    leftRail = document.createElement("div");
    leftRail.id = "claude-ra-left";
    leftRail.className = "claude-ra-no-media claude-ra-collapsed";

    leftRail.innerHTML = `
      <div class="claude-ra-progress-row">
        <span class="claude-ra-time">
          <span class="claude-ra-current">0:00</span>/<span class="claude-ra-duration">0:00</span>
        </span>

        <div class="claude-ra-seek-wrap">
          <input class="claude-ra-range claude-ra-seek-slider claude-ra-media-control"
                 type="range" min="0" max="100" step="0.01" value="0" disabled>
        </div>
      </div>
    `;

    rightRail = document.createElement("div");
    rightRail.id = "claude-ra-right";
    rightRail.className = "claude-ra-no-media claude-ra-collapsed";

    rightRail.innerHTML = `
      <div class="claude-ra-transport-row claude-ra-media-control">
        <button class="claude-ra-icon-btn claude-ra-play claude-ra-media-control"
                disabled>
          ${getLucideSvg("play")}
        </button>

        <button class="claude-ra-icon-btn claude-ra-seek10 claude-ra-back claude-ra-media-control"
                disabled>
          ${getLucideSvg("rotate-ccw")}
          <span class="claude-ra-ten">10</span>
        </button>

        <button class="claude-ra-icon-btn claude-ra-seek10 claude-ra-forward claude-ra-media-control"
                disabled>
          ${getLucideSvg("rotate-cw")}
          <span class="claude-ra-ten">10</span>
        </button>
      </div>

      <div class="claude-ra-speed-wrap claude-ra-media-control">
        <button class="claude-ra-icon-btn claude-ra-speed-btn" disabled>
          ${getSavedSpeed()}×
        </button>
        <div class="claude-ra-popover claude-ra-speed-menu"></div>
      </div>

      <div class="claude-ra-volume-wrap claude-ra-media-control">
        <button class="claude-ra-icon-btn claude-ra-volume-btn" disabled>
          ${getLucideSvg("volume-2")}
        </button>
        <div class="claude-ra-volume-popover">
          <input class="claude-ra-range claude-ra-volume-slider"
                 type="range" min="0" max="1" step="0.01"
                 value="${getSavedVolume()}">
          <span class="claude-ra-volume-value">${Math.round(getSavedVolume() * 100)}%</span>
        </div>
      </div>

      <button class="claude-ra-icon-btn claude-ra-download claude-ra-media-control"
              disabled>
        ${getLucideSvg("download")}
      </button>

      <div class="claude-ra-help-wrap">
        <button class="claude-ra-icon-btn">
          ${getLucideSvg("circle-help")}
        </button>
        <div class="claude-ra-popover claude-ra-help"></div>
      </div>

    `;

    document.body.append(floatingToggle, leftRail, rightRail);

    playerLayout = new PlayerLayout(leftRail, rightRail, floatingToggle, scheduleLayoutSync, () => showStatus(recoveryCopy().savedError, true), () => settingsCache?.language);
    seekSlider = leftRail.querySelector(".claude-ra-seek-slider");
    currentLabel = leftRail.querySelector(".claude-ra-current");
    durationLabel = leftRail.querySelector(".claude-ra-duration");
    playButton = rightRail.querySelector(".claude-ra-play");

    speedButton = rightRail.querySelector(".claude-ra-speed-btn");
    speedMenu = rightRail.querySelector(".claude-ra-speed-menu");
    volumeWrap = rightRail.querySelector(".claude-ra-volume-wrap");
    volumeSlider = rightRail.querySelector(".claude-ra-volume-slider");
    volumeLabel = rightRail.querySelector(".claude-ra-volume-value");
    downloadButton = rightRail.querySelector(".claude-ra-download");

    CONFIG.speeds.forEach((speed) => {
      const item = document.createElement("button");
      item.className = "claude-ra-speed-option";
      item.type = "button";
      item.dataset.speed = String(speed);
      item.textContent = `${speed}×`;

      item.addEventListener("click", () => {
        setSpeed(speed);
        rightRail?.querySelector(".claude-ra-speed-wrap")?.classList.remove("claude-open");
      });

      speedMenu?.appendChild(item);
    });

    speedButton?.addEventListener("click", (event) => {
      event.stopPropagation();
      rightRail?.querySelector(".claude-ra-speed-wrap")?.classList.toggle("claude-open");
      playerLayout?.positionPopovers();
    });

    document.addEventListener('click', event => {
      if (!(event.target instanceof Node) || !rightRail?.contains(event.target)) {
        rightRail?.querySelectorAll('.claude-open').forEach(el => el.classList.remove('claude-open'));
        playerLayout?.positionPopovers();
      }
    });
    for (const selector of ['.claude-ra-help-wrap', '.claude-ra-volume-wrap']) {
      const wrap = rightRail.querySelector<HTMLElement>(selector);
      wrap?.querySelector('button')?.addEventListener('click', event => { event.stopPropagation(); wrap.classList.toggle('claude-open'); playerLayout?.positionPopovers(); });
    }
    rightRail.addEventListener('click', () => playerLayout?.positionPopovers());


    playButton?.addEventListener("click", togglePlayback);

    installHoldSeek(rightRail.querySelector(".claude-ra-back") as HTMLElement, -1);
    installHoldSeek(rightRail.querySelector(".claude-ra-forward") as HTMLElement, 1);

    seekSlider?.addEventListener("pointerdown", () => {
      sliderDragging = true;
    });

    seekSlider?.addEventListener("input", () => {
      if (!activeMedia || !seekSlider || !currentLabel) return;
      const target = parseFloat(seekSlider.value);
      seekAbsolute(target, false);
      currentLabel.textContent = formatTime(target);
    });

    const finishSeek = () => {
      if (!sliderDragging || !seekSlider) return;
      sliderDragging = false;
      seekAbsolute(parseFloat(seekSlider.value), true);
    };

    seekSlider?.addEventListener("pointerup", finishSeek);
    seekSlider?.addEventListener("pointercancel", finishSeek);

    volumeSlider?.addEventListener("input", () => {
      if (!volumeSlider) return;
      setVolume(parseFloat(volumeSlider.value));
    });

    volumeWrap?.addEventListener(
      "wheel",
      (event: WheelEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const delta = event.deltaY < 0 ? 0.05 : -0.05;
        const current = activeMedia ? activeMedia.volume : getSavedVolume();
        setVolume(clamp(current + delta, 0, 1));
      },
      { passive: false }
    );

    downloadButton?.addEventListener("click", downloadCurrentAudio);

    applyI18nLabels();
    setControlsEnabled(Boolean(activeMedia));
    detectAndCacheClaudeTheme();
    syncComposerLayout();
  }

  function setControlsEnabled(enabled: boolean): void {
    if (!leftRail || !rightRail || cache.controlsEnabled === enabled) return;
    cache.controlsEnabled = enabled;

    leftRail.classList.toggle("claude-ra-no-media", !enabled);
    rightRail.classList.toggle("claude-ra-no-media", !enabled);

    leftRail.querySelectorAll<HTMLButtonElement | HTMLInputElement>("input").forEach((el) => {
      el.disabled = !enabled;
    });

    rightRail
      .querySelectorAll<HTMLButtonElement | HTMLInputElement>(
        ".claude-ra-transport-row button, .claude-ra-speed-btn, .claude-ra-volume-btn, .claude-ra-volume-slider, .claude-ra-download",
      )
      .forEach((el) => {
        el.disabled = !enabled;
      });

    const helpButton = rightRail.querySelector<HTMLButtonElement>(".claude-ra-help-wrap > button");
    if (helpButton) helpButton.disabled = false;

  }

  // ---------------------------------------------------------------------
  // Layout Alignment
  // ---------------------------------------------------------------------

  let layoutRaf: number | null = null;
  function scheduleLayoutSync(): void {
    if (layoutRaf) return;
    layoutRaf = requestAnimationFrame(() => {
      layoutRaf = null;
      syncComposerLayout();
    });
  }

  let observedComposer: HTMLElement | null = null;
  const composerObserver = new ResizeObserver(scheduleLayoutSync);
  const composerAttributes = new MutationObserver(scheduleLayoutSync);
  let conversationPath = location.pathname;
  function getComposer(): HTMLElement | null {
    const editor = document.querySelector<HTMLElement>('[data-testid="chat-input"][contenteditable="true"]');
    if (!editor) return null;
    for (let parent = editor.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const style = getComputedStyle(parent), r = parent.getBoundingClientRect();
      if (r.width > 180 && parseFloat(style.borderTopLeftRadius) >= 8 && style.backgroundColor !== 'rgba(0, 0, 0, 0)') return parent;
    }
    return editor.closest<HTMLElement>('[data-cds="ChatComposer"]') || editor.parentElement;
  }

  function syncComposerLayout(): void {
    if (!leftRail || !rightRail || !floatingToggle) return;

    if (location.pathname !== conversationPath) {
      conversationPath = location.pathname;
      playback.dispose(); activeMedia = null; userForcedExpand = false;
      updateControls();
    }
    const composer = getComposer();
    if (composer !== observedComposer) {
      composerObserver.disconnect();
      composerAttributes.disconnect();
      observedComposer = composer;
      for (let parent: HTMLElement | null = composer; parent; parent = parent.parentElement) {
        composerObserver.observe(parent);
        composerAttributes.observe(parent, { attributes: true, attributeFilter: ['class', 'style', 'hidden', 'data-state'] });
      }
    }
    const settings = getSavedSettings();
    const hasSession = Boolean(activeMedia && !activeMedia.ended);
    const shouldExpand = !userForcedCollapsed && (hasSession || userForcedExpand);
    const visible = floatingVisibility(Boolean(settings.floatingUiHidden), settings.floatingUiHideMode || 'idle-only', hasSession, shouldExpand);
    leftRail.classList.toggle('claude-ra-collapsed', !visible.player);
    rightRail.classList.toggle('claude-ra-collapsed', !visible.player);
    floatingToggle.classList.toggle('claude-ra-hidden', !(visible.launcher || visible.player));
    floatingToggle.setAttribute('aria-expanded', String(visible.player));
    floatingToggle.setAttribute('aria-label', visible.player ? getI18n().content.tooltips.collapse : getI18n().content.tooltips.expand);
    cache.isCollapsed = !visible.player;
    cache.floatingHidden = !visible.launcher;
    playerLayout?.sync(composer, visible.player);
  }

  function installHoldSeek(button: HTMLElement | null, direction: number): void {
    if (!button) return;

    let holding = false;
    let holdStarted = 0;
    let lastFrame = 0;
    let becameHold = false;
    let smoothScrubbingEnabled = true;
    let raf: number | null = null;
    let pointerId: number | null = null;

    const frame = (now: number) => {
      if (!holding) return;
      if (!smoothScrubbingEnabled) return;

      const heldFor = (now - holdStarted) / 1000;

      if (heldFor < 0.28) {
        raf = requestAnimationFrame(frame);
        return;
      }

      becameHold = true;

      if (!lastFrame) lastFrame = now;
      const dt = Math.max(0, (now - lastFrame) / 1000);
      lastFrame = now;

      let seekRate: number;
      if (heldFor < 1.5) seekRate = 4;
      else if (heldFor < 3) seekRate = 10;
      else if (heldFor < 6) seekRate = 25;
      else seekRate = 50;

      seekRelative(direction * seekRate * dt, false);
      updateControls();

      raf = requestAnimationFrame(frame);
    };

    button.addEventListener("pointerdown", (event: PointerEvent) => {
      if ((button as HTMLButtonElement).disabled || event.button !== 0) return;

      event.preventDefault();

      holding = true;
      pointerId = event.pointerId;
      becameHold = false;
      smoothScrubbingEnabled = getSavedSettings().smoothScrubbing !== false;
      holdStarted = performance.now();
      lastFrame = 0;

      try {
        button.setPointerCapture(event.pointerId);
      } catch (_) {}

      raf = requestAnimationFrame(frame);
    });

    const stop = (event: PointerEvent) => {
      if (!holding) return;
      if (event.pointerId !== pointerId) return;
      holding = false;

      if (raf) cancelAnimationFrame(raf);

      if (!becameHold) {
        const step = getSavedSettings().tapSeekSeconds || CONFIG.tapSeekSeconds;
        seekRelative(direction * step);
      }

      try {
        if (pointerId !== null && button.hasPointerCapture(pointerId)) {
          button.releasePointerCapture(pointerId);
        }
      } catch (_) {}

      pointerId = null;
    };

    button.addEventListener("pointerup", stop);
    button.addEventListener("pointercancel", stop);
    button.addEventListener("lostpointercapture", stop);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  function seekAbsolute(target: number, update = true): void {
    if (!activeMedia) return;

    const info = getSeekInfo(activeMedia);
    if (!info.seekable) return;

    target = clamp(target, info.start, info.end);

    try {
      playback.seek(target);
    } catch (error) {
      warn("Seek failed:", error);
    }

    if (update) updateControls();
  }

  function seekRelative(seconds: number, update = true): void {
    if (!activeMedia) return;
    seekAbsolute((playback.time) + seconds, update);
  }

  // ---------------------------------------------------------------------
  // Playback / speed / volume with DOM Cache
  // ---------------------------------------------------------------------

  function togglePlayback(): void {
    playback.toggle();
    updateControls();
    broadcastLiveAudioState(true);
    scheduleLayoutSync();
  }

  function setSpeed(speed: number): void {
    if (!Number.isFinite(speed) || speed <= 0) return;

    sessionSpeed = speed;
    localStorage.setItem(CONFIG.speedStorage, String(speed));

    if (activeMedia) {
      try {
        activeMedia.playbackRate = speed;
        activeMedia.defaultPlaybackRate = speed;
      } catch (_) {}
    }

    updateControls();
    broadcastLiveAudioState(true);
  }

  function setVolume(volume: number): void {
    volume = clamp(volume, 0, 1);

    sessionVolume = volume;
    localStorage.setItem(CONFIG.volumeStorage, String(volume));

    if (activeMedia) {
      try {
        activeMedia.volume = volume;
        activeMedia.muted = false;
      } catch (_) {}
    }

    updateControls();
    broadcastLiveAudioState(true);
  }

  function updateControls(): void {
    if (!leftRail || !rightRail) return;

    if (!activeMedia) {
      setControlsEnabled(false);
      return;
    }

    setControlsEnabled(true);
    downloadButton?.toggleAttribute("disabled", !playback.state.capabilities.download);

    const current = playback.time;
    const info = getSeekInfo(activeMedia);

    const formattedCur = formatTime(current);
    if (currentLabel && cache.currentTimeStr !== formattedCur) {
      cache.currentTimeStr = formattedCur;
      currentLabel.textContent = formattedCur;
    }

    const durationNum = Number.isFinite(playback.duration)
      ? playback.duration
      : info.seekable
      ? info.end
      : 0;

    const formattedDur = durationNum > 0 ? formatTime(durationNum) : "--:--";
    if (durationLabel && cache.durationStr !== formattedDur) {
      cache.durationStr = formattedDur;
      durationLabel.textContent = formattedDur;
    }

    if (seekSlider) {
      if (info.seekable) {
        if (seekSlider.disabled) seekSlider.disabled = false;
        seekSlider.min = String(info.start);
        seekSlider.max = String(info.end);

        if (!sliderDragging) {
          seekSlider.value = String(clamp(current, info.start, info.end));
        }
      } else if (!seekSlider.disabled) {
        seekSlider.disabled = true;
      }
    }

    const isPaused = playback.paused;
    playButton?.setAttribute('aria-busy', String(playback.loading));
    playButton?.classList.toggle('claude-ra-buffering', playback.loading);
    if (playButton) {
      playButton.dataset.defaultTitle ||= playButton.title;
      playButton.title = playback.loading ? recoveryCopy().pending : playButton.dataset.defaultTitle;
      playButton.setAttribute('aria-label', playButton.title);
    }
    if (cache.isPaused !== isPaused) {
      cache.isPaused = isPaused;
      setIcon(playButton, isPaused ? "play" : "pause");
    }

    const speed = activeMedia.playbackRate || getSavedSpeed();
    if (cache.speed !== speed) {
      cache.speed = speed;
      if (speedButton) speedButton.textContent = `${speed}×`;

      speedMenu?.querySelectorAll<HTMLElement>(".claude-ra-speed-option").forEach((item) => {
        item.classList.toggle(
          "claude-selected",
          Math.abs(parseFloat(item.dataset.speed || "0") - speed) < 0.001,
        );
      });
    }

    const volume = activeMedia.volume;
    const isMuted = activeMedia.muted || volume <= 0;

    if (cache.volume !== volume || cache.isMuted !== isMuted) {
      cache.volume = volume;
      cache.isMuted = isMuted;

      if (volumeSlider) volumeSlider.value = String(volume);
      if (volumeLabel) volumeLabel.textContent = `${Math.round((isMuted ? 0 : volume) * 100)}%`;

      const volumeButton = rightRail.querySelector<HTMLElement>(".claude-ra-volume-btn");
      if (isMuted) {
        setIcon(volumeButton, "volume-x");
      } else if (volume < 0.5) {
        setIcon(volumeButton, "volume-1");
      } else {
        setIcon(volumeButton, "volume-2");
      }
    }
  }

  // ---------------------------------------------------------------------
  // Download Audio
  // ---------------------------------------------------------------------

  function extensionFor(mime: string, _url = ''): string {
    if (mime.includes('webm')) return 'webm';
    if (mime.includes('wav')) return 'wav';
    throw new Error('Unsupported download format');
  }

  async function resolveDownloadBlob(): Promise<{ blob: Blob; mime: string; url: string }> {
    const blob = await playback.blob();
    return { blob, mime: blob.type, url: activeMedia?.currentSrc || activeMedia?.src || '' };
  }

  async function downloadCurrentAudio(): Promise<void> {
    if (!activeMedia || !downloadButton) return;

    const downloadMedia = activeMedia;
    showStatus(recoveryCopy().downloading);
    downloadButton.setAttribute("disabled", "true");
    downloadButton.classList.add("claude-ra-download-busy");
    setIcon(downloadButton, "loader-circle");

    try {
      const { blob, mime, url } = await resolveDownloadBlob();

      if (activeMedia !== downloadMedia) throw new Error("The reply changed before the download was ready.");
      const ext = extensionFor(mime || blob.type, url);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `claude-read-aloud-${timestamp}.${ext}`;

      const objectURL = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectURL;
      link.download = filename;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(objectURL), 5000);

      log("Downloaded audio:", filename, blob.size, mime);
    } catch (error) {
      warn("Download failed:", error);
      showStatus(recoveryCopy().downloadError, true);
    } finally {
      downloadButton.classList.remove("claude-ra-download-busy");
      downloadButton.removeAttribute("disabled");
      setIcon(downloadButton, "download");
    }
  }

  // ---------------------------------------------------------------------
  // Shortcuts
  // ---------------------------------------------------------------------

  window.addEventListener(
    "keydown",
    (event: KeyboardEvent) => {
      const settings = getSavedSettings();
      if (settings.enableShortcuts === false) return;

      const target = event.target instanceof HTMLElement ? event.target : null;

      if (
        target?.matches("input, textarea, select, [contenteditable='true']") ||
        target?.isContentEditable ||
        target?.closest("button, a, input, textarea, select, [role='button']")
      ) {
        return;
      }

      if (!activeMedia) return;

      const action = playbackAction(event);
      if (!action || Object.values(commandBindings).some(binding => binding && matchesShortcut(event, binding))) return;
      event.preventDefault();
      event.stopPropagation();
      if (action === 'play') { event.stopImmediatePropagation(); if (event.repeat) return; }
      const names = { play: 'play-pause', back: 'seek-back', forward: 'seek-forward', slower: 'speed-decrease', faster: 'speed-increase' } as const;
      dispatchAction(names[action]);
    },
    true,
  );

  function toggleCollapsed(): void {
    const expanded = !cache.isCollapsed;
    userForcedExpand = !expanded; userForcedCollapsed = expanded; scheduleLayoutSync();
  }
  function dispatchAction(command: PlayerCommand): void {
    const step = getSavedSettings().tapSeekSeconds || CONFIG.tapSeekSeconds;
    if (command === 'toggle-collapse') return toggleCollapsed();
    if (command === 'reset-layout') { void playerLayout?.reset(); return; }
    if (command === 'open-help') {
      userForcedExpand = true; userForcedCollapsed = false;
      // Compact docks hide Help inside the overflow menu; reveal both ancestors.
      rightRail?.querySelectorAll('.claude-ra-extras, .claude-ra-help-wrap').forEach(el => el.classList.add('claude-open'));
      scheduleLayoutSync(); return;
    }
    if (command === 'open-settings') { window.postMessage({ source: 'claude-audio-controls-settings-bridge', type: 'CLAUDE_RA_OPEN_SETTINGS' }, location.origin); if (standalone) openStandaloneSettings(settingsCache || DEFAULT_SETTINGS, value => { settingsCache = value; readyToast.clear(); applyI18nLabels(); scheduleLayoutSync(); }); return; }
    if (!activeMedia) return;
    if (command === 'play-pause') togglePlayback();
    if (command === 'seek-back') seekRelative(-step);
    if (command === 'seek-forward') seekRelative(step);
    if (command === 'speed-decrease') changeSpeed(-1);
    if (command === 'speed-increase') changeSpeed(1);
    if (command === 'speed-reset') setSpeed(1);
    if (command === 'volume-increase') setVolume(clamp(activeMedia.volume + .05, 0, 1));
    if (command === 'volume-decrease') setVolume(clamp(activeMedia.volume - .05, 0, 1));
    if (command === 'toggle-mute') { activeMedia.muted = !activeMedia.muted; updateControls(); }
    if (command === 'download-audio') void downloadCurrentAudio();
  }

  function changeSpeed(direction: number): void {
    const current = activeMedia?.playbackRate || getSavedSpeed();

    let closestIndex = 0;
    let closestDistance = Infinity;

    CONFIG.speeds.forEach((speed, index) => {
      const distance = Math.abs(speed - current);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    const next = clamp(closestIndex + direction, 0, CONFIG.speeds.length - 1);
    setSpeed(CONFIG.speeds[next]);
  }

  // ---------------------------------------------------------------------
  // DOM Observer & Poller (Zero Thrashing, Immediate Theme Sync)
  // ---------------------------------------------------------------------

  let observerTimeout: number | null = null;
  let themeTimeout: number | null = null;

  function scheduleThemeSync(): void {
    if (themeTimeout) return;

    themeTimeout = window.setTimeout(() => {
      themeTimeout = null;
      detectAndCacheClaudeTheme();
    }, 250);
  }

  const themeObserver = new MutationObserver(scheduleThemeSync);
  let observedThemeElements: HTMLElement[] = [];
  function bindThemeObservers(): void {
    const elements = activeThemeElements();
    if (elements.length === observedThemeElements.length && elements.every((el, i) => el === observedThemeElements[i])) return;
    themeObserver.disconnect(); observedThemeElements = elements;
    for (const el of elements) themeObserver.observe(el, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-mode', 'data-color-version', 'style'] });
  }

  function startObserver(): void {
    // Structural changes can replace the composer, but attribute
    // changes across the whole Claude tree are far too noisy (hover/focus
    // state alone can produce many). Keep this observer child-list only.
    const observer = new MutationObserver(() => {
      if (observerTimeout) return;
      observerTimeout = window.setTimeout(() => {
        observerTimeout = null;
        bindThemeObservers();
        scheduleThemeSync();
        scheduleLayoutSync();
      }, 500);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    bindThemeObservers();
    window.addEventListener('focus', scheduleThemeSync);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { bindThemeObservers(); scheduleThemeSync(); } });

    window.addEventListener("resize", scheduleLayoutSync, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleLayoutSync, { passive: true });
    window.visualViewport?.addEventListener('scroll', scheduleLayoutSync, { passive: true });
    window.addEventListener("scroll", scheduleLayoutSync, { passive: true });

    window.setInterval(() => {
      scheduleThemeSync();
      scheduleLayoutSync();
    }, 5000);
  }

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------

  function initUI(): void {
    if (!document.body) {
      requestAnimationFrame(initUI);
      return;
    }

    installSettingsBridge();
    buildUI();
    startObserver();

    log("Claude Audio Controls Extension Ready");
  }

  playback.install();
  // Capture audio from document_start, but don't insert UI into a partial body.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI, { once: true });
  } else {
    initUI();
  }
})();
