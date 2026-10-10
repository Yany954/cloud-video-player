/** A video file on the phone, ready to be sent: what the upload engine reads from. */
export interface UploadSource {
  /** A `file://` address inside the app's own storage. */
  uri: string;
  fileName: string;
  sizeBytes: number;
  /** Identifies the same video when it is chosen again, to resume. Null for a new recording. */
  assetId: string | null;
  durationSeconds: number | null;
  /** A small picture of the video, made on the phone; null if it could not be made. */
  thumbnailUri: string | null;
}

/** "The same video, chosen again": the picker hands over a new copy each time. */
export function fingerprint(userId: string, source: UploadSource): string {
  return [userId, source.assetId ?? source.fileName, source.sizeBytes].join(':');
}
