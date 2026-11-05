import { describe, expect, test } from 'bun:test';
import { nativeFormat, opusDuration, wav } from '../src/audio/formats';
describe('native protocol boundary', () => {
  test('only the native reply socket and two verified formats match', () => {
    expect(nativeFormat('wss://claude.ai/api/ws/text_to_speech/text_stream?output_format=pcm_16000')).toBe('pcm_16000');
    for (const url of ['wss://evil.test/api/ws/text_to_speech/text_stream?output_format=pcm_16000', 'wss://claude.ai/voice?output_format=pcm_16000', 'ws://claude.ai/api/ws/text_to_speech/text_stream?output_format=pcm_16000', 'wss://claude.ai/api/ws/text_to_speech/text_stream?output_format=new_codec']) expect(nativeFormat(url)).toBeNull();
  });
  test('Opus durations follow TOC, with malformed frame counts rejected', () => {
    expect(opusDuration(new Uint8Array([0x98, 0]))).toBe(.02);
    expect(opusDuration(new Uint8Array([0x80, 0]))).toBe(.0025);
    expect(opusDuration(new Uint8Array([0x99, 0]))).toBe(.04);
    expect(() => opusDuration(new Uint8Array([0x9b, 0]))).toThrow();
    expect(() => opusDuration(new Uint8Array([0x9b, 7]))).toThrow();
  });
  test('WAV duration and sample bytes are exact', async () => {
    const bytes = new Uint8Array(32000); bytes[10] = 42;
    const output = await wav([bytes], bytes.length).arrayBuffer(), view = new DataView(output);
    expect(output.byteLength).toBe(32044); expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(40, true)).toBe(32000); expect(view.getUint8(54)).toBe(42);
    expect(() => wav([new Uint8Array(3)], 3)).toThrow();
  });
});
