import type { RemuxPlan } from '../application/ports';

/** Arguments that repackage `input` into a web-ready MP4 at `output`, following the plan. */
export function remuxArgs(plan: RemuxPlan, input: string, output: string): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    input,
    // First video and first audio only: phones add data tracks that MP4 players reject.
    '-map',
    '0:v:0',
    ...(plan.audio === 'none' ? [] : ['-map', '0:a:0']),
    '-c:v',
    'copy',
    ...(plan.videoTag ? ['-tag:v', plan.videoTag] : []),
    ...(plan.audio === 'copy' ? ['-c:a', 'copy'] : []),
    ...(plan.audio === 'transcode-to-aac' ? ['-c:a', 'aac', '-b:a', '192k'] : []),
    '-map_metadata',
    '0',
    // Index at the start of the file: playback begins before the download finishes.
    '-movflags',
    '+faststart',
    '-f',
    'mp4',
    output,
  ];
}

/** One frame from a tenth of the way in (at most 30 s), as a JPEG no wider than 1280 px. */
export function posterArgs(input: string, output: string, durationSeconds: number): string[] {
  const at = Math.min(durationSeconds / 10, 30);
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-ss',
    at.toFixed(3),
    '-i',
    input,
    '-frames:v',
    '1',
    '-vf',
    "scale='min(1280,iw)':-2",
    '-q:v',
    '3',
    output,
  ];
}
