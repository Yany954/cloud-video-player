import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { inSendingOrder, parseQueue, type QueuedUpload } from './queue';
import type { UploadSource } from './source';

const keyFor = (userId: string) => `cvp.upload-queue:${userId}`;

/**
 * Prepared videos wait here until they are sent. In the cache folder on purpose: it is not
 * copied into iCloud backups, and if the phone runs out of space the system may clear it, in
 * which case the video simply has to be chosen again.
 */
const keptDirectory = () => new Directory(Paths.cache, 'upload-queue');

/**
 * The upload queue as it is kept on the phone, per signed-in person. Ids and file addresses
 * only: nothing secret. Each change is written at once, so closing the app loses nothing.
 */
export class QueueStore {
  private entries: QueuedUpload[] = [];
  /** Writes happen one after another, so an older state never overwrites a newer one. */
  private writing: Promise<void> = Promise.resolve();

  constructor(private readonly userId: string) {}

  /** Reads what an earlier run of the app left. Entries whose file is gone are dropped. */
  async load(): Promise<{ kept: QueuedUpload[]; lost: QueuedUpload[] }> {
    const stored = parseQueue(await AsyncStorage.getItem(keyFor(this.userId)).catch(() => null));
    const kept = stored.filter((entry) => new File(entry.uri).exists);
    const lost = stored.filter((entry) => !kept.includes(entry));
    this.entries = inSendingOrder(kept);
    if (lost.length > 0) this.persist();
    return { kept: this.entries, lost };
  }

  /** Takes over the prepared file (and its picture) and remembers the video. */
  async add(source: UploadSource, eventId: string | null): Promise<QueuedUpload> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const directory = keptDirectory();
    if (!directory.exists) directory.create({ intermediates: true, idempotent: true });

    const extension = source.fileName.includes('.') ? source.fileName.split('.').pop() : 'mp4';
    const file = new File(directory, `${id}.${extension}`);
    await new File(source.uri).move(file);

    let thumbnailUri: string | null = null;
    if (source.thumbnailUri) {
      try {
        const picture = new File(directory, `${id}.jpg`);
        await new File(source.thumbnailUri).move(picture);
        thumbnailUri = picture.uri;
      } catch {
        // A video without a picture uploads all the same.
      }
    }

    const entry: QueuedUpload = {
      ...source,
      id,
      uri: file.uri,
      thumbnailUri,
      eventId,
      videoId: null,
      addedAt: new Date().toISOString(),
    };
    this.entries = [...this.entries, entry];
    this.persist();
    return entry;
  }

  /** The server upload exists: from now on this video resumes instead of starting over. */
  setVideoId(id: string, videoId: string | null): void {
    this.entries = this.entries.map((entry) => (entry.id === id ? { ...entry, videoId } : entry));
    this.persist();
  }

  get(id: string): QueuedUpload | undefined {
    return this.entries.find((entry) => entry.id === id);
  }

  all(): QueuedUpload[] {
    return this.entries;
  }

  /** Sent, cancelled or given up: forget it and free the space its file took. */
  remove(id: string): void {
    const entry = this.get(id);
    if (!entry) return;
    this.entries = this.entries.filter((other) => other.id !== id);
    this.persist();
    discard(entry.uri);
    if (entry.thumbnailUri) discard(entry.thumbnailUri);
  }

  private persist(): void {
    const snapshot = JSON.stringify(this.entries);
    this.writing = this.writing
      .then(() => AsyncStorage.setItem(keyFor(this.userId), snapshot))
      // Uploads still work; they just would not survive closing the app.
      .catch(() => {});
  }
}

/** A prepared file that will not be sent after all (e.g. the same video chosen twice). */
export function discard(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A leftover in the cache is harmless; the system clears it.
  }
}
