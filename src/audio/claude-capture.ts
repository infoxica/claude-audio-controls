import { isClaudeChatRoute } from '../shared/claude-route';
import { nativeFormat, isNativeSpeechSocket } from './formats';
import { StreamPlayer, supported } from './stream-player';
import { emptyState, type PlaybackState } from './types';
import type { ListeningActivity } from '../content/listening-use';

const ACTION = '[data-testid="action-bar-read-aloud"]';
const COMPATIBILITY = 'Audio controls could not take over this reply. Use Claude’s native Read aloud button to continue.';
type Intent = { button: HTMLButtonElement; path: string; time: number };

/** Captures only a native reply requested by a Read aloud action in this tab. */
export class ClaudePlayback {
  private player: StreamPlayer | null = null;
  private intent: Intent | null = null;
  private native: HTMLButtonElement | null = null;
  private proxy: HTMLButtonElement | null = null;
  private originalHidden = false;
  private nativeClick = false;
  private generation = 0;
  private taken = false;
  private taking = false;
  private unwatch: (() => void) | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private socketAbort: AbortController | null = null;
  private ready = false;
  private lastData = 0;
  private capabilities = { pcm_16000: false, opus_48000_32: false };

  constructor(
    private changed: (media: HTMLAudioElement | null) => void,
    private failed: (message: string) => void,
    private retained: (ready: boolean) => void = () => {},
    private activity: (activity: ListeningActivity) => void = () => {},
    private actionLabel: (paused: boolean) => string = paused => paused ? 'Resume read aloud' : 'Pause read aloud',
  ) {}
  get media(): HTMLAudioElement | null { return this.player?.media || null; }
  get state(): PlaybackState { return this.player?.state || emptyState(); }
  get time(): number { return this.state.position; }
  get duration(): number { return this.state.duration || 0; }
  get playing(): boolean { return this.state.status === 'playing'; }
  get paused(): boolean { return !['playing', 'buffering'].includes(this.state.status); }
  get loading(): boolean { return this.state.status === 'buffering' || this.taking; }
  isOwned(media: HTMLMediaElement): boolean { return media === this.media; }
  seek(seconds: number): void { this.player?.seek(seconds); }
  toggle(): void { if (this.paused) void this.player?.play().catch(() => this.failed('Press play to allow audio in this browser.')); else this.player?.pause(); }
  get format() { return this.player?.format; }
  blob(format: 'native' | 'wav' = 'native'): Promise<Blob> { return this.player ? this.player.download(format) : Promise.reject(new Error('No completed reply')); }

  install(): void {
    if (window.top !== window || location.origin !== 'https://claude.ai') return;
    for (const format of ['pcm_16000', 'opus_48000_32'] as const) void supported(format).then(ok => { this.capabilities[format] = ok; });
    window.addEventListener('click', event => {
      if (this.nativeClick || !isClaudeChatRoute() || !(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>(ACTION);
      if (!button) return;
      this.dispose();
      this.intent = { button, path: location.pathname, time: performance.now() };
    }, true);
    const Original = window.WebSocket;
    const self = this;
    window.WebSocket = new Proxy(Original, {
      construct(target, args, newTarget) {
        const socket: WebSocket = Reflect.construct(target, args, newTarget);
        const format = nativeFormat(args[0]);
        const intent = self.intent;
        if (!isClaudeChatRoute() || !isNativeSpeechSocket(args[0]) || !intent || intent.path !== location.pathname || !intent.button.isConnected || performance.now() - intent.time > 15000) return socket;
        self.intent = null;
        if (!format || !self.capabilities[format]) { self.failed(COMPATIBILITY); return socket; }
        self.capture(socket, format, intent);
        return socket;
      },
    });
    window.addEventListener('pagehide', () => this.dispose());
    window.addEventListener('popstate', () => this.dispose());
  }

  private capture(socket: WebSocket, format: 'pcm_16000' | 'opus_48000_32', intent: Intent): void {
    this.dispose();
    const generation = this.generation;
    this.native = intent.button;
    const player = this.player = new StreamPlayer(String(generation), format);
    this.socketAbort = new AbortController();
    const options = { signal: this.socketAbort.signal };
    const current = () => this.player === player && generation === this.generation;
    this.lastData = performance.now();
    this.unwatch = player.subscribe(state => {
      if (!current()) return;
      if (state.error) { this.fallback(); return; }
      this.syncProxy();
      if (this.taken) this.changed(player.media);
      if (state.capabilities.download && !this.ready) { this.ready = true; this.retained(true); }
      this.activity({ session: generation, event: state.status === 'ended' ? 'ended' : state.status === 'paused' ? 'pause' : 'progress',
        position: state.position, duration: state.duration || 0, rate: state.rate, advancing: state.status === 'playing', now: performance.now() });
    });
    let terminal = false;
    socket.addEventListener('message', event => {
      if (!current()) return;
      this.lastData = performance.now();
      if (event.data instanceof ArrayBuffer) {
        if (terminal) { this.fallback(); return; }
        player.enqueue(event.data);
        if (!this.taken && !this.taking && current()) void this.takeover(generation);
      } else if (typeof event.data === 'string') {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'SpeechComplete') { terminal = true; player.finish(); }
          else if (message.type === 'SpeechError' || message.type === 'error') this.fallback();
        } catch { this.fallback(); }
      } else this.fallback(); // Protocol drift must never intercept an unknown format.
    }, options);
    socket.addEventListener('error', () => { if (current() && !terminal) this.fallback(); }, options);
    socket.addEventListener('close', () => { if (current() && !terminal) this.fallback(); }, options);
    this.watchdog = setInterval(() => {
      if (!current()) return;
      if (location.pathname !== intent.path || !intent.button.isConnected) { this.dispose(); return; }
      if (!terminal && performance.now() - this.lastData > 60000) this.fallback();
    }, 500);
  }

  private async takeover(generation: number): Promise<void> {
    const native = this.native, player = this.player;
    if (!native || !player) return;
    this.taking = true;
    // React may not have committed the playing state when the first frame arrives.
    // Until pause is acknowledged, the owned audio remains silent.
    for (let attempt = 0; attempt < 25 && this.generation === generation; attempt++) {
      if (native.dataset.state === 'playing') break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    if (this.generation !== generation) return;
    if (native.dataset.state !== 'playing') { this.fallback(); return; }
    this.nativeClick = true;
    try { native.click(); } finally { this.nativeClick = false; }
    for (let attempt = 0; attempt < 50 && this.generation === generation; attempt++) {
      if (native.getAttribute('data-state') === 'paused') break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    if (this.generation !== generation) return;
    if (native.getAttribute('data-state') !== 'paused') { this.fallback(); return; }
    this.taking = false; this.taken = true;
    this.originalHidden = native.hidden;
    this.proxy = native.cloneNode(true) as HTMLButtonElement;
    this.proxy.removeAttribute('data-testid'); this.proxy.removeAttribute('id');
    this.proxy.dataset.claudeRaAction = '';
    this.proxy.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); this.toggle(); });
    native.hidden = true; native.after(this.proxy);
    this.changed(player.media);
    this.activity({ session: generation, event: 'start', position: 0, duration: 0, rate: 1, advancing: false, now: performance.now() });
    void player.play().catch(() => this.failed('Press play to allow audio in this browser.'));
  }

  private syncProxy(): void {
    if (!this.proxy) return;
    this.proxy.dataset.state = this.paused ? 'paused' : 'playing';
    this.proxy.setAttribute('aria-label', this.actionLabel(this.paused));
    this.proxy.setAttribute('aria-pressed', String(!this.paused));
    this.proxy.title = this.proxy.getAttribute('aria-label')!;
    this.proxy.innerHTML = this.paused ? '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m7 3 15 9-15 9z"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 3h4v18H6zM14 3h4v18h-4z"/></svg>';
  }
  private fallback(): void { this.dispose(); this.failed(COMPATIBILITY); }
  dispose(): void {
    const session = this.generation;
    this.generation++;
    this.intent = null;
    this.socketAbort?.abort(); this.socketAbort = null;
    if (this.watchdog) clearInterval(this.watchdog); this.watchdog = null;
    this.unwatch?.(); this.unwatch = null;
    this.player?.dispose(); this.player = null;
    if (this.native && this.taken) this.native.hidden = this.originalHidden;
    this.proxy?.remove(); this.proxy = null; this.native = null;
    this.taken = this.taking = this.ready = false;
    this.activity({ session, event: 'dispose', position: 0, duration: 0, rate: 1, advancing: false, now: performance.now() });
    this.retained(false); this.changed(null);
  }
}
