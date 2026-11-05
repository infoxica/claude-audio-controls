import { AppendOnlyStreamTarget, AudioSample, AudioSampleSource, BufferTarget, EncodedAudioPacketSource, EncodedPacket, Output, WebMOutputFormat } from 'mediabunny';
import { MAX_RETAINED_BYTES, opusDuration, STREAM_MIME, wav } from './formats';
import { emptyState, type NativeFormat, type PlaybackAdapter, type PlaybackState } from './types';

const decoderConfig: AudioDecoderConfig = { codec: 'opus', sampleRate: 48000, numberOfChannels: 1 };
export async function supported(format: NativeFormat): Promise<boolean> {
  if (typeof MediaSource === 'undefined' || !MediaSource.isTypeSupported(STREAM_MIME)) return false;
  if (format === 'opus_48000_32') return true;
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') return false;
  try { return (await AudioEncoder.isConfigSupported({ codec: 'opus', sampleRate: 16000, numberOfChannels: 1, bitrate: 32000 })).supported === true; }
  catch { return false; }
}

/** One reply, one owned media element. All asynchronous writes are serialized. */
export class StreamPlayer implements PlaybackAdapter {
  readonly media = new Audio();
  private source = new MediaSource();
  private sourceBuffer: SourceBuffer | null = null;
  private output: Output | null = null;
  private track: AudioSampleSource | EncodedAudioPacketSource | null = null;
  private url = '';
  private listeners = new Set<(state: PlaybackState) => void>();
  private abort = new AbortController();
  private parts: Uint8Array<ArrayBuffer>[] = [];
  private retained = 0;
  private muxed = 0;
  private receivedSeconds = 0;
  private pendingByte: number | null = null;
  private closed = false;
  private complete = false;
  private wantsPlay = false;
  private error: string | null = null;
  private work: Promise<void>;
  private downloadWork: Promise<Blob> | null = null;
  private acceptFrames = true;

  constructor(readonly id: string, readonly format: NativeFormat, private limit = MAX_RETAINED_BYTES) {
    this.media.preload = 'auto';
    this.media.preservesPitch = true;
    this.media.setAttribute('data-claude-ra-owned', '');
    this.media.addEventListener('error', () => this.fail('The browser could not decode this audio.'), { signal: this.abort.signal });
    for (const name of ['playing', 'pause', 'waiting', 'ended', 'timeupdate', 'progress', 'seeked', 'ratechange', 'volumechange']) {
      this.media.addEventListener(name, () => { if (name === 'ended') this.wantsPlay = false; this.emit(); }, { signal: this.abort.signal });
    }
    this.work = this.initialize().catch(error => this.fail(error));
  }

  private async initialize(): Promise<void> {
    if (!await supported(this.format)) throw new Error('This browser does not support native audio playback controls.');
    if (this.closed) return;
    const opened = this.event(this.source, 'sourceopen');
    this.url = URL.createObjectURL(this.source);
    this.media.src = this.url;
    this.media.load();
    await opened;
    this.sourceBuffer = this.source.addSourceBuffer(STREAM_MIME);
    this.output = new Output({
      format: new WebMOutputFormat({ appendOnly: true, minimumClusterDuration: .2 }),
      target: new AppendOnlyStreamTarget(new WritableStream<Uint8Array>({ write: data => this.append(data) })),
    });
    this.track = this.format === 'pcm_16000' ? new AudioSampleSource({ codec: 'opus', bitrate: 32000 }) : new EncodedAudioPacketSource('opus');
    this.output.addAudioTrack(this.track);
    await this.output.start();
  }

  private event(target: EventTarget, name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const done = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error('Audio stream interrupted')); };
      const cleanup = () => { target.removeEventListener(name, done); target.removeEventListener('error', failed); this.abort.signal.removeEventListener('abort', failed); };
      target.addEventListener(name, done, { once: true });
      target.addEventListener('error', failed, { once: true });
      this.abort.signal.addEventListener('abort', failed, { once: true });
      if (this.abort.signal.aborted) failed();
    });
  }

  private checkBudget(): void {
    // Reserve space for the native copy, encoder input, final download (including
    // BufferTarget growth) and MSE bytes. Browser decoder internals are not JS retention.
    if (this.retained * 4 + this.muxed * 2 + (this.parts.length + 1) * 1024 + 65536 > this.limit) throw new Error('This reply exceeds the 64 MiB audio memory limit.');
  }

  private async append(data: Uint8Array): Promise<void> {
    if (this.closed || !this.sourceBuffer) throw new Error('Session ended');
    this.muxed += data.byteLength; this.checkBudget();
    const ready = this.event(this.sourceBuffer, 'updateend');
    try { this.sourceBuffer.appendBuffer(data as Uint8Array<ArrayBuffer>); }
    catch (error) { this.fail(error); }
    await ready;
    this.emit();
  }

  enqueue(buffer: ArrayBuffer): void {
    if (this.closed || !this.acceptFrames) return;
    try {
      if (!buffer.byteLength) throw new Error('Empty audio frame');
      this.retained += buffer.byteLength; this.checkBudget();
      // The native listener retains ownership of its event. Never detach it.
      const bytes = new Uint8Array(buffer.slice(0));
      this.parts.push(bytes);
      this.work = this.work.then(() => this.add(bytes)).catch(error => this.fail(error));
    } catch (error) { this.fail(error); }
  }

  private async add(bytes: Uint8Array<ArrayBuffer>): Promise<void> {
    if (this.closed || !this.track) return;
    if (this.format === 'opus_48000_32') {
      const duration = opusDuration(bytes);
      await (this.track as EncodedAudioPacketSource).add(new EncodedPacket(bytes, 'key', this.receivedSeconds, duration), { decoderConfig });
      this.receivedSeconds += duration;
    } else {
      let input = bytes;
      if (this.pendingByte !== null) { input = new Uint8Array(bytes.length + 1); input[0] = this.pendingByte; input.set(bytes, 1); this.pendingByte = null; }
      if (input.length % 2) { this.pendingByte = input[input.length - 1]; input = input.subarray(0, -1); }
      if (!input.length) return;
      const sample = new AudioSample({ data: input, format: 's16', sampleRate: 16000, numberOfChannels: 1, timestamp: this.receivedSeconds });
      try { await (this.track as AudioSampleSource).add(sample); this.receivedSeconds += sample.duration; }
      finally { sample.close(); }
    }
    this.emit();
  }

  finish(): void {
    if (!this.acceptFrames || this.closed) return;
    this.acceptFrames = false;
    this.work = this.work.then(async () => {
      if (this.closed) return;
      if (!this.retained || this.pendingByte !== null) throw new Error('The reply ended with incomplete audio.');
      await this.output!.finalize();
      if (this.closed) return;
      this.source.endOfStream();
      this.complete = true; this.emit();
    }).catch(error => this.fail(error));
  }

  fail(error: unknown): void {
    if (this.closed) return;
    this.error = error instanceof Error ? error.message : 'Native audio is unavailable.';
    this.dispose();
  }

  get state(): PlaybackState {
    const media = this.media, buffered = media.buffered;
    const end = buffered.length ? buffered.end(buffered.length - 1) : 0;
    const start = buffered.length ? buffered.start(0) : 0;
    return {
      ...emptyState(), sessionId: this.id,
      status: this.error ? 'error' : this.closed ? 'idle' : media.ended ? 'ended' : !this.wantsPlay ? 'paused' : media.readyState < 3 || media.paused ? 'buffering' : 'playing',
      position: media.currentTime || 0, buffered: { start, end }, duration: this.complete ? this.receivedSeconds : null,
      rate: media.playbackRate, volume: media.muted ? 0 : media.volume,
      capabilities: { seek: !this.closed && end > start, download: this.complete && !this.closed, rate: !this.closed, volume: !this.closed }, error: this.error,
    };
  }
  async play(): Promise<void> {
    if (this.closed) return;
    this.wantsPlay = true; this.emit();
    try {
      await this.work;
      if (this.closed || !this.wantsPlay) return;
      if (this.media.ended) this.media.currentTime = 0;
      await this.media.play();
    } catch (error) {
      if (!this.closed && this.wantsPlay) { this.wantsPlay = false; this.emit(); throw error; }
    }
  }
  pause(): void { this.wantsPlay = false; this.media.pause(); this.emit(); }
  seek(seconds: number): void {
    if (!Number.isFinite(seconds) || !this.state.capabilities.seek) return;
    this.media.currentTime = Math.max(this.state.buffered.start, Math.min(seconds, this.state.buffered.end - .001)); this.emit();
  }
  changeRate(rate: number): void { if (Number.isFinite(rate)) this.media.playbackRate = Math.max(.5, Math.min(3, rate)); }
  changeVolume(volume: number): void { if (Number.isFinite(volume)) this.media.volume = Math.max(0, Math.min(1, volume)); }
  subscribe(listener: (state: PlaybackState) => void): () => void { this.listeners.add(listener); listener(this.state); return () => this.listeners.delete(listener); }
  private emit(): void { for (const listener of this.listeners) listener(this.state); }
  async download(): Promise<Blob> {
    if (!this.complete || this.closed) throw new Error('Wait for the reply to finish generating.');
    return this.downloadWork ||= this.createDownload();
  }
  private async createDownload(): Promise<Blob> {
    if (this.format === 'pcm_16000') return wav(this.parts, this.retained);
    const target = new BufferTarget(), output = new Output({ target, format: new WebMOutputFormat() });
    const source = new EncodedAudioPacketSource('opus'); output.addAudioTrack(source);
    await output.start(); let timestamp = 0;
    try {
      for (const part of this.parts) {
        if (this.closed) throw new Error('Session ended');
        const duration = opusDuration(part);
        await source.add(new EncodedPacket(part, 'key', timestamp, duration), { decoderConfig }); timestamp += duration;
      }
      await output.finalize();
      return new Blob([target.buffer!], { type: 'audio/webm' });
    } catch (error) { await output.cancel(); throw error; }
  }
  dispose(): void {
    if (this.closed) return;
    this.closed = true; this.acceptFrames = false; this.wantsPlay = false;
    this.abort.abort(); this.media.pause(); this.media.removeAttribute('src'); this.media.load();
    if (this.url) URL.revokeObjectURL(this.url);
    // Finalization already releases the encoder and writer. Cancel only unfinished output.
    if (this.output && this.output.state !== 'finalized') void this.output.cancel().catch(() => {});
    this.output = null;
    this.sourceBuffer = null; this.track = null; this.parts = []; this.downloadWork = null; this.retained = 0;
    this.emit(); this.listeners.clear();
  }
}
