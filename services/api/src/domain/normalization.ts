import type { MediaInfo, ProcessingFailureReason } from './video';

/** What a probe of the uploaded file found. Codec names are ffprobe's, lower case. */
export interface ProbeResult extends MediaInfo {
  /** null when the file has no video stream. */
  videoCodec: string | null;
  /** null when the file has no audio stream. */
  audioCodec: string | null;
}

export type NormalizationPlan =
  | {
      kind: 'remux';
      /** The video stream is always copied untouched: no quality loss. */
      video: 'copy';
      /** HEVC needs this tag for Apple players to accept it inside an MP4. */
      videoTag: 'hvc1' | null;
      audio: 'copy' | 'transcode-to-aac' | 'none';
    }
  | { kind: 'unsupported'; reason: ProcessingFailureReason };

// Processing runs where temporary disk is capped at 10 GiB; leave room for the poster and overhead.
export const MAX_REMUX_BYTES = 9 * 1024 ** 3;

const COPYABLE_VIDEO_CODECS = ['h264', 'hevc'];

/**
 * Decides how to make an upload playable in browsers and native players.
 * Anything that would need re-encoding the video is left to a heavier pipeline.
 */
export function planNormalization(probe: ProbeResult, sizeBytes: number): NormalizationPlan {
  if (probe.videoCodec === null) return { kind: 'unsupported', reason: 'NO_VIDEO_STREAM' };
  if (!COPYABLE_VIDEO_CODECS.includes(probe.videoCodec)) {
    return { kind: 'unsupported', reason: 'UNSUPPORTED_VIDEO_CODEC' };
  }
  if (sizeBytes > MAX_REMUX_BYTES) return { kind: 'unsupported', reason: 'TOO_LARGE' };

  return {
    kind: 'remux',
    video: 'copy',
    videoTag: probe.videoCodec === 'hevc' ? 'hvc1' : null,
    audio:
      probe.audioCodec === null ? 'none' : probe.audioCodec === 'aac' ? 'copy' : 'transcode-to-aac',
  };
}
