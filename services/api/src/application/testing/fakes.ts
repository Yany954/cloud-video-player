import type { Category } from '../../domain/category';
import { DomainError } from '../../domain/errors';
import { awaitsReview, isInLibrary } from '../../domain/moderation';
import { DEFAULT_QUOTA_BYTES, fits, type StorageUsage } from '../../domain/quota';
import type { Video } from '../../domain/video';
import type {
  CategoryRepository,
  ObjectStorage,
  PartUrl,
  ProcessingQueue,
  StorageAccountAdmin,
  UploadedPart,
  VideoRepository,
} from '../ports';

/** Videos and storage accounts share state, like the single DynamoDB table does. */
export class InMemoryDatabase implements VideoRepository, StorageAccountAdmin {
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

  async listByCategory(categoryId: string, limit: number) {
    return [...this.videos.values()]
      .filter((video) => video.categoryId === categoryId)
      .slice(0, limit);
  }

  async saveCategoryOf(video: Video) {
    const stored = this.videos.get(video.id);
    if (!stored) throw new Error('No such video');
    this.videos.set(video.id, { ...stored, categoryId: video.categoryId, private: video.private });
  }

  /** The categories, as their own repository (the names clash with the video methods). */
  readonly categories: CategoryRepository & { items: Map<string, Category> } = (() => {
    const items = new Map<string, Category>();
    const newestFirst = (a: Category, b: Category) => b.createdAt.localeCompare(a.createdAt);
    return {
      items,
      async create(category) {
        items.set(category.id, category);
      },
      async findById(id) {
        return items.get(id) ?? null;
      },
      async listByOwner(ownerId, limit) {
        return [...items.values()]
          .filter((category) => category.ownerId === ownerId)
          .sort(newestFirst)
          .slice(0, limit);
      },
      async listShared(limit) {
        return [...items.values()]
          .filter((category) => category.visibility === 'shared')
          .sort(newestFirst)
          .slice(0, limit);
      },
      async listByMember(userId, limit) {
        return [...items.values()]
          .filter((category) => category.collaboratorIds.includes(userId))
          .sort(newestFirst)
          .slice(0, limit);
      },
      async save(category) {
        items.set(category.id, category);
      },
      async join(category) {
        if (items.get(category.id)?.inviteToken !== category.inviteToken) {
          throw new DomainError('INVALID_STATE', 'Invite link changed');
        }
        items.set(category.id, category);
      },
      async leave(category) {
        items.set(category.id, category);
      },
      async delete(category) {
        items.delete(category.id);
      },
    };
  })();

  async listAwaitingReview(limit: number) {
    return [...this.videos.values()]
      .filter(awaitsReview)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit);
  }

  async listLibrary(limit: number) {
    return [...this.videos.values()]
      .filter(isInLibrary)
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

  async deleteCounted(video: Video) {
    const stored = this.videos.get(video.id);
    if (!stored || stored.uploadStatus !== video.uploadStatus) {
      throw new DomainError('INVALID_STATE', 'Video changed');
    }
    const usage = await this.getUsage(video.ownerId);
    this.usage.set(video.ownerId, {
      ...usage,
      bytesUsed: usage.bytesUsed - (video.sizeBytes ?? 0),
    });
    this.videos.delete(video.id);
  }

  async getUsage(userId: string) {
    return this.usage.get(userId) ?? { bytesUsed: 0, quotaBytes: DEFAULT_QUOTA_BYTES };
  }

  async getUsages(userIds: readonly string[]) {
    return new Map(
      await Promise.all(userIds.map(async (id) => [id, await this.getUsage(id)] as const)),
    );
  }

  async setQuota(userId: string, quotaBytes: number) {
    this.usage.set(userId, { ...(await this.getUsage(userId)), quotaBytes });
  }
}

export class InMemoryObjectStorage implements ObjectStorage {
  readonly sessions = new Map<string, Map<number, UploadedPart>>();
  /** videoId -> size of the joined original. */
  readonly originals = new Map<string, number>();
  /** videoIds that have a playable version. */
  readonly playables = new Set<string>();
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

  async deletePlayable(video: Video) {
    this.playables.delete(video.id);
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
