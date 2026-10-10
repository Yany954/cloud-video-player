/** A video file on the phone, ready to be sent: what the upload engine reads from. */
export interface UploadSource {
  /** A `file://` address inside the app's own storage. */
  uri: string;
  fileName: string;
  sizeBytes: number;
  /** Identifies the video in the photo library. Null for a new recording. */
  assetId: string | null;
  durationSeconds: number | null;
  /** A small picture of the video, made on the phone; null if it could not be made. */
  thumbnailUri: string | null;
}
