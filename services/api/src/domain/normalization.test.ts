import { describe, expect, it } from 'vitest';
import { MAX_REMUX_BYTES, planNormalization, type ProbeResult } from './normalization';

const probe = (overrides: Partial<ProbeResult> = {}): ProbeResult => ({
  videoCodec: 'h264',
  audioCodec: 'aac',
  durationSeconds: 60,
  width: 1920,
  height: 1080,
  ...overrides,
});

describe('planNormalization', () => {
  it('copies H.264 + AAC untouched', () => {
    expect(planNormalization(probe(), 1_000)).toEqual({
      kind: 'remux',
      video: 'copy',
      videoTag: null,
      audio: 'copy',
    });
  });

  it('copies HEVC (the iPhone default) and tags it for Apple players', () => {
    expect(planNormalization(probe({ videoCodec: 'hevc' }), 1_000)).toMatchObject({
      kind: 'remux',
      video: 'copy',
      videoTag: 'hvc1',
    });
  });

  it.each(['pcm_s16le', 'ac3', 'opus', 'mp3'])(
    'converts only the audio when it is %s',
    (audioCodec) => {
      expect(planNormalization(probe({ audioCodec }), 1_000)).toMatchObject({
        kind: 'remux',
        video: 'copy',
        audio: 'transcode-to-aac',
      });
    },
  );

  it('handles a silent video', () => {
    expect(planNormalization(probe({ audioCodec: null }), 1_000)).toMatchObject({ audio: 'none' });
  });

  it.each(['mpeg4', 'prores', 'vp9', 'av1'])('leaves %s video to the re-encoding pipeline', (c) => {
    expect(planNormalization(probe({ videoCodec: c }), 1_000)).toEqual({
      kind: 'unsupported',
      reason: 'UNSUPPORTED_VIDEO_CODEC',
    });
  });

  it('rejects a file with no video stream', () => {
    expect(planNormalization(probe({ videoCodec: null }), 1_000)).toEqual({
      kind: 'unsupported',
      reason: 'NO_VIDEO_STREAM',
    });
  });

  it('accepts a file exactly at the size limit and rejects one byte more', () => {
    expect(planNormalization(probe(), MAX_REMUX_BYTES).kind).toBe('remux');
    expect(planNormalization(probe(), MAX_REMUX_BYTES + 1)).toEqual({
      kind: 'unsupported',
      reason: 'TOO_LARGE',
    });
  });
});
