import type { StorageUsage } from '../domain/quota';
import type { NormalizationPlan, ProbeResult } from '../domain/normalization';
import type { Video } from '../domain/video';

// Ports: what the use cases need from the outside world. AWS adapters in infrastructure/
// implement them; tests use the in-memory fakes in application/testing.

export interface VideoRepository {
  create(video: Video): Promise<void>;
  findById(id: string): Promise<Video | null>;
  /** The owner's videos in every state, newest first. */
  listByOwner(ownerId: string, limit: number): Promise<Video[]>;
  /** Playable videos waiting for an admin's decision, oldest first. */
  listAwaitingReview(limit: number): Promise<Video[]>;
  /** Approved, playable videos from every owner, newest first. */
  listLibrary(limit: number): Promise<Video[]>;
  /**
   * One atomic write: stores the uploaded video and adds its size to the owner's usage.
   * Throws DomainError QUOTA_EXCEEDED (and writes nothing) if that would pass the quota.
   */
  saveCompleted(video: Video): Promise<void>;
  /** Overwrites an existing video with its new state. */
  save(video: Video): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface StorageAccountRepository {
  /** A user who never uploaded has 0 bytes used and the default quota. */
  getUsage(userId: string): Promise<StorageUsage>;
}

export interface UploadedPart {
  partNumber: number;
  etag: string;
  sizeBytes: number;
}

export interface PartUrl {
  partNumber: number;
  url: string;
}

export interface ObjectStorage {
  /** Returns the upload session id. */
  startMultipartUpload(video: Video): Promise<string>;
  listUploadedParts(video: Video, sessionId: string): Promise<UploadedPart[]>;
  /** Short-lived URLs the client PUTs each part to, directly. */
  signPartUrls(video: Video, sessionId: string, partNumbers: number[]): Promise<PartUrl[]>;
  /** Joins the parts and returns the measured size of the final object. */
  completeMultipartUpload(video: Video, sessionId: string, parts: UploadedPart[]): Promise<number>;
  abortMultipartUpload(video: Video, sessionId: string): Promise<void>;
  deleteOriginal(video: Video): Promise<void>;
}

export interface MediaProcessor {
  /** Reads the uploaded original and reports what is inside it. */
  probe(video: Video): Promise<ProbeResult>;
  /** Writes the playable version and its poster image, following the plan. */
  normalize(video: Video, plan: RemuxPlan, probe: ProbeResult): Promise<void>;
}

export type RemuxPlan = Extract<NormalizationPlan, { kind: 'remux' }>;

export interface ProcessingQueue {
  /** Asks for the video to be made playable, in the background. */
  enqueue(videoId: string): Promise<void>;
}

export interface PlaybackUrls {
  video: string;
  poster: string;
}

export interface PlaybackUrlSigner {
  /** Time-limited links to a video's playable file and poster. */
  sign(videoId: string, expiresAt: Date): Promise<PlaybackUrls>;
}

export type IdGenerator = () => string;
export type Clock = () => Date;
