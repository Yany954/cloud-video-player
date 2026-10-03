import type { ProbeResult } from '../domain/normalization';

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  disposition?: { attached_pic?: number };
  side_data_list?: { rotation?: number }[];
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: { duration?: string };
}

/** Turns `ffprobe -print_format json -show_streams -show_format` output into a ProbeResult. */
export function parseFfprobeOutput(json: string): ProbeResult {
  const output = JSON.parse(json) as FfprobeOutput;
  const streams = output.streams ?? [];
  // Cover art in audio files is reported as a video stream; it is not a video.
  const video = streams.find(
    (stream) => stream.codec_type === 'video' && !stream.disposition?.attached_pic,
  );
  const audio = streams.find((stream) => stream.codec_type === 'audio');

  // Phones store portrait video as landscape pixels plus a rotation flag.
  const rotation = video?.side_data_list?.find((data) => data.rotation !== undefined)?.rotation;
  const sideways = rotation !== undefined && Math.abs(rotation) % 180 === 90;
  const width = video?.width ?? 0;
  const height = video?.height ?? 0;

  return {
    videoCodec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
    durationSeconds: Number(output.format?.duration ?? 0) || 0,
    width: sideways ? height : width,
    height: sideways ? width : height,
  };
}
