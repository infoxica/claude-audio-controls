export type NativeFormat = 'pcm_16000' | 'opus_48000_32';
export type PlaybackStatus = 'idle' | 'buffering' | 'playing' | 'paused' | 'ended' | 'error';
export interface PlaybackState {
  sessionId: string | null;
  status: PlaybackStatus;
  position: number;
  buffered: { start: number; end: number };
  duration: number | null;
  rate: number;
  volume: number;
  capabilities: { seek: boolean; download: boolean; rate: boolean; volume: boolean };
  error: string | null;
}
export interface PlaybackAdapter {
  readonly state: PlaybackState;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  changeRate(rate: number): void;
  changeVolume(volume: number): void;
  download(format?: 'native' | 'wav'): Promise<Blob>;
  subscribe(listener: (state: PlaybackState) => void): () => void;
  dispose(): void;
}
export const emptyState = (): PlaybackState => ({
  sessionId: null, status: 'idle', position: 0, buffered: { start: 0, end: 0 }, duration: null,
  rate: 1, volume: 1, capabilities: { seek: false, download: false, rate: false, volume: false }, error: null,
});
