import type { Category } from '../domain/category';
import type { StorageUsage } from '../domain/quota';
import type { Block, Report } from '../domain/safety';
import type { UserAccount, UserRole } from '../domain/user';
import type { NormalizationPlan, ProbeResult } from '../domain/normalization';
import type { Video } from '../domain/video';

// Ports: what the use cases need from the outside world. AWS adapters in infrastructure/
// implement them; tests use the in-memory fakes in application/testing.

export interface VideoRepository {
  create(video: Video): Promise<void>;
  findById(id: string): Promise<Video | null>;
  /** The owner's videos in every state, newest first. */
  listByOwner(ownerId: string, limit: number): Promise<Video[]>;
  /** Every video put in the category, whatever its state. */
  listByCategory(categoryId: string, limit: number): Promise<Video[]>;
  /** Playable videos waiting for an admin's decision, oldest first. */
  listAwaitingReview(limit: number): Promise<Video[]>;
  /**
   * One atomic write: stores the uploaded video and adds its size to the owner's usage.
   * Throws DomainError QUOTA_EXCEEDED (and writes nothing) if that would pass the quota.
   */
  saveCompleted(video: Video): Promise<void>;
  /** Overwrites an existing video with its new state. */
  save(video: Video): Promise<void>;
  /**
   * Stores only the video's category and privacy, leaving every other attribute as it is in
   * the table, so it cannot undo a change another job made meanwhile.
   */
  saveCategoryOf(video: Video): Promise<void>;
  /**
   * Stores only the moderation status and who decided. A review or a report must not undo
   * what happened to the video meanwhile, such as being moved to another category.
   */
  saveModeration(video: Video): Promise<void>;
  delete(id: string): Promise<void>;
  /**
   * One atomic write: removes a video whose bytes were counted and gives them back to its
   * owner. Throws DomainError INVALID_STATE (and writes nothing) if the video changed or was
   * already deleted, so the same bytes are never given back twice.
   */
  deleteCounted(video: Video): Promise<void>;
}

export interface CategoryRepository {
  create(category: Category): Promise<void>;
  findById(id: string): Promise<Category | null>;
  /** Newest first. */
  listByOwner(ownerId: string, limit: number): Promise<Category[]>;
  /** Categories every signed-in user can see, newest first. */
  listShared(limit: number): Promise<Category[]>;
  /** Categories the user joined through an invite link, newest first. */
  listByMember(userId: string, limit: number): Promise<Category[]>;
  /** Overwrites an existing category with its new state. */
  save(category: Category): Promise<void>;
  /**
   * One atomic write: records `userId` as a collaborator of the category. Throws DomainError
   * INVALID_STATE (and writes nothing) if the invite link changed meanwhile.
   */
  join(category: Category, userId: string): Promise<void>;
  /** One atomic write: stores the category without that collaborator, and forgets the membership. */
  leave(category: Category, userId: string): Promise<void>;
  /** Removes the category and its collaborators' memberships. */
  delete(category: Category): Promise<void>;
}

export interface UserDirectory {
  /** Email addresses of the given users. Users that no longer exist are left out. */
  emailsOf(userIds: readonly string[]): Promise<Map<string, string>>;
}

/** An unguessable secret for invite links. */
export type TokenGenerator = () => string;

export interface ReportRepository {
  /** False (and nothing stored) if this person already reported this video. */
  add(report: Report): Promise<boolean>;
  /** Oldest first. */
  listByVideo(videoId: string): Promise<Report[]>;
  deleteByVideo(videoId: string): Promise<void>;
}

export interface BlockRepository {
  /** Blocking the same person again only refreshes the entry. */
  add(block: Block): Promise<void>;
  remove(blockerId: string, blockedId: string): Promise<void>;
  /** Newest first. */
  listByBlocker(blockerId: string): Promise<Block[]>;
  /** Forgets every block this person made. */
  deleteByBlocker(blockerId: string): Promise<void>;
}

export interface StorageAccountRepository {
  /** A user who never uploaded has 0 bytes used and the default quota. */
  getUsage(userId: string): Promise<StorageUsage>;
}

/** What the admin Users view needs on top of reading one user's usage. */
export interface StorageAccountAdmin extends StorageAccountRepository {
  /** The same, for many users at once. Every requested user is in the result. */
  getUsages(userIds: readonly string[]): Promise<Map<string, StorageUsage>>;
  /** Changes how much one user may store. Works for a user who never uploaded. */
  setQuota(userId: string, quotaBytes: number): Promise<void>;
  /** Forgets the user's storage record. */
  deleteAccount(userId: string): Promise<void>;
}

export interface AccountDeletionQueue {
  /** Asks for everything the user owns to be removed, in the background. */
  enqueue(userId: string): Promise<void>;
}

/** The accounts themselves (Cognito), as the admin Users view needs them. */
export interface UserAccounts {
  /** Oldest first. */
  list(limit: number): Promise<UserAccount[]>;
  findById(userId: string): Promise<UserAccount | null>;
  /**
   * Creates the account and emails the person a temporary password.
   * Throws DomainError USER_EXISTS if that email already has an account.
   */
  invite(email: string): Promise<UserAccount>;
  setRole(userId: string, role: UserRole): Promise<void>;
  /** Suspending also signs the person out of every device. */
  setSuspended(userId: string, suspended: boolean): Promise<void>;
  countAdmins(): Promise<number>;
  /** True if this is the user's current password. */
  verifyPassword(userId: string, password: string): Promise<boolean>;
  /** Removes the sign-in account itself. Fine if it is already gone. */
  delete(userId: string): Promise<void>;
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
  /** Removes the playable version and its poster. Fine if they were never made. */
  deletePlayable(video: Video): Promise<void>;
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
