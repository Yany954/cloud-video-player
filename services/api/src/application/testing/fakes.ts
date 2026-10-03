import { DomainError } from '../../domain/errors';
import { DEFAULT_QUOTA_BYTES, fits, type StorageUsage } from '../../domain/quota';
import type { Video } from '../../domain/video';
import type {
  ObjectStorage,
  PartUrl,
  ProcessingQueue,
  StorageAccountRepository,
  UploadedPart,
  VideoRepository,
} from '../ports';

/** Videos and storage accounts share state, like the single DynamoDB table does. */
export class InMemoryDatabase implements VideoRepository, StorageAccountRepository {
  readonly videos = new Map<string, Video>();
  readonly usage = new Map<string, StorageUsage>();

  async create(video: Video) {
    this.videos.set(video.id, video);
  }

  async findById(id: string) {
    return this.videos.get(id) ?? null;
  }

  async listByOwner(ownerId: string, limit: number) {
    return [...this.videos.values()]
      .filter((video) => video.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async saveCompleted(video: Video) {
    const usage = await this.getUsage(video.ownerId);
    const sizeBytes = video.sizeBytes ?? 0;
    if (!fits(usage, sizeBytes)) throw new DomainError('QUOTA_EXCEEDED', 'Quota exceeded');
    this.usage.set(video.ownerId, { ...usage, bytesUsed: usage.bytesUsed + sizeBytes });
    this.videos.set(video.id, video);
  }

  async save(video: Video) {
    this.videos.set(video.id, video);
  }

  async delete(id: string) {
    this.videos.delete(id);
  }

  async getUsage(userId: string) {
    return this.usage.get(userId) ?? { bytesUsed: 0, quotaBytes: DEFAULT_QUOTA_BYTES };
  }
}

export class InMemoryObjectStorage implements ObjectStorage {
  readonly sessions = new Map<string, Map<number, UploadedPart>>();
  /** videoId -> size of the joined original. */
  readonly originals = new Map<string, number>();
  private nextSession = 1;

  /** Simulates the client PUTting one part to its presigned URL. */
  putPart(sessionId: string, partNumber: number, sizeBytes: number) {
    this.session(sessionId).set(partNumber, { partNumber, etag: `etag-${partNumber}`, sizeBytes });
  }

  async startMultipartUpload() {
    const sessionId = `session-${this.nextSession++}`;
    this.sessions.set(sessionId, new Map());
    return sessionId;
  }

  async listUploadedParts(_video: Video, sessionId: string) {
    return [...this.session(sessionId).values()].sort((a, b) => a.partNumber - b.partNumber);
  }

  async signPartUrls(video: Video, sessionId: string, partNumbers: number[]): Promise<PartUrl[]> {
    this.session(sessionId);
    return partNumbers.map((partNumber) => ({
      partNumber,
      url: `https://storage.test/${video.ownerId}/${video.id}?session=${sessionId}&part=${partNumber}`,
    }));
  }

  async completeMultipartUpload(video: Video, sessionId: string, parts: UploadedPart[]) {
    this.session(sessionId);
    const sizeBytes = parts.reduce((total, part) => total + part.sizeBytes, 0);
    this.sessions.delete(sessionId);
    this.originals.set(video.id, sizeBytes);
    return sizeBytes;
  }

  async abortMultipartUpload(_video: Video, sessionId: string) {
    this.sessions.delete(sessionId);
  }

  async deleteOriginal(video: Video) {
    this.originals.delete(video.id);
  }

  private session(sessionId: string) {
    const parts = this.sessions.get(sessionId);
    if (!parts) throw new Error(`No such upload session: ${sessionId}`);
    return parts;
  }
}

export class InMemoryProcessingQueue implements ProcessingQueue {
  readonly videoIds: string[] = [];

  async enqueue(videoId: string) {
    this.videoIds.push(videoId);
  }
}
