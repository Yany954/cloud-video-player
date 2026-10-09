/** What can be shown about a file before it is uploaded. Either part may be unknown. */
export interface UploadPreview {
  /** A small JPEG of the first moments, as a data URL. */
  posterUrl: string | null;
  durationSeconds: number | null;
}

const THUMBNAIL_PX = 112;
const GIVE_UP_AFTER_MS = 8000;

// One file at a time: decoding several large videos at once can stall a phone.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Reads a thumbnail and the duration from a local video file, in the browser. Nothing is sent
 * anywhere. A file this browser cannot decode (some MKV, AVI or HEVC files) resolves with
 * nulls, never an error: the preview is a convenience and must not get in the way of uploading.
 */
export function readPreview(file: File): Promise<UploadPreview> {
  const next = queue.then(() => readNow(file));
  queue = next.catch(() => undefined);
  return next;
}

function readNow(file: File): Promise<UploadPreview> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let durationSeconds: number | null = null;

    const finish = (posterUrl: string | null) => {
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      resolve({ posterUrl, durationSeconds });
    };
    const timer = setTimeout(() => finish(null), GIVE_UP_AFTER_MS);

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onerror = () => finish(null);
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        durationSeconds = Math.round(video.duration);
      }
      // A little way in: the very first frame is often black.
      video.currentTime = Math.min(1, (video.duration || 0) / 2);
    };
    video.onseeked = () => finish(drawFrame(video));
    video.src = url;
  });
}

function drawFrame(video: HTMLVideoElement): string | null {
  const { videoWidth, videoHeight } = video;
  if (!videoWidth || !videoHeight) return null;
  // A centred square, like the posters in the video lists.
  const side = Math.min(videoWidth, videoHeight);
  const canvas = document.createElement('canvas');
  canvas.width = THUMBNAIL_PX;
  canvas.height = THUMBNAIL_PX;
  const context = canvas.getContext('2d');
  if (!context) return null;
  try {
    context.drawImage(
      video,
      (videoWidth - side) / 2,
      (videoHeight - side) / 2,
      side,
      side,
      0,
      0,
      THUMBNAIL_PX,
      THUMBNAIL_PX,
    );
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return null;
  }
}
