import type { NativeFormat } from './types';

export const MAX_RETAINED_BYTES = 64 * 1024 * 1024;
export const STREAM_MIME = 'audio/webm; codecs="opus"';

// Never match voice conversations or arbitrary WebSockets. Authentication,
// voice and pace parameters remain entirely under Claude's control.
export function isNativeSpeechSocket(value: string | URL): boolean {
  try {
    const url = new URL(String(value));
    return url.protocol === 'wss:' && url.hostname === 'claude.ai' && !url.port &&
      url.pathname === '/api/ws/text_to_speech/text_stream';
  } catch { return false; }
}
export function nativeFormat(value: string | URL): NativeFormat | null {
  try {
    if (!isNativeSpeechSocket(value)) return null;
    const url = new URL(String(value));
    const format = url.searchParams.get('output_format');
    return format === 'pcm_16000' || format === 'opus_48000_32' ? format : null;
  } catch { return null; }
}

// RFC 6716 section 3.1: packet duration comes from the TOC, not arrival time.
export function opusDuration(packet: Uint8Array): number {
  if (!packet.length) throw new Error('Empty Opus packet');
  const toc = packet[0], config = toc >> 3, code = toc & 3;
  const frameMs = config >= 16 ? 2.5 * 2 ** (config & 3) :
    config >= 12 ? 10 * 2 ** (config & 1) : [10, 20, 40, 60][config & 3];
  if (code === 3 && packet.length < 2) throw new Error('Truncated Opus packet');
  const frames = code === 0 ? 1 : code === 3 ? packet[1] & 63 : 2;
  if (!frames || frameMs * frames > 120) throw new Error('Invalid Opus duration');
  return frameMs * frames / 1000;
}

export function wav(parts: Uint8Array<ArrayBuffer>[], bytes: number): Blob {
  if (!bytes || bytes % 2) throw new Error('Incomplete PCM samples');
  const header = new ArrayBuffer(44), view = new DataView(header);
  const ascii = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, 'RIFF'); view.setUint32(4, 36 + bytes, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, bytes, true);
  return new Blob([header, ...parts], { type: 'audio/wav' });
}
