import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  NoSuchUpload,
  UploadPartCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ObjectStorage, PartUrl, UploadedPart } from '../application/ports';
import type { Video } from '../domain/video';
import { contentTypeOf } from '../domain/video-format';

const PART_URL_TTL_SECONDS = 60 * 60;

/** Each user's originals live under their own prefix. */
export const originalKey = (video: Video) =>
  `uploads/${video.ownerId}/${video.id}/original.${video.format}`;

/** The playable version and its poster, in the media bucket. */
export const mediaKeys = (videoId: string) => ({
  video: `media/${videoId}/video.mp4`,
  poster: `media/${videoId}/poster.jpg`,
});

export class S3ObjectStorage implements ObjectStorage {
  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
    private readonly mediaBucket: string,
  ) {}

  async startMultipartUpload(video: Video): Promise<string> {
    const { UploadId } = await this.s3.send(
      new CreateMultipartUploadCommand({
        ...this.target(video),
        ContentType: contentTypeOf(video.format),
      }),
    );
    if (!UploadId) throw new Error('S3 did not return an UploadId');
    return UploadId;
  }

  async listUploadedParts(video: Video, sessionId: string): Promise<UploadedPart[]> {
    const parts: UploadedPart[] = [];
    let marker: string | undefined;
    // S3 returns at most 1,000 parts per page.
    do {
      const page = await this.s3.send(
        new ListPartsCommand({
          ...this.target(video),
          UploadId: sessionId,
          PartNumberMarker: marker,
        }),
      );
      for (const part of page.Parts ?? []) {
        parts.push({ partNumber: part.PartNumber!, etag: part.ETag!, sizeBytes: part.Size! });
      }
      marker = page.IsTruncated ? page.NextPartNumberMarker : undefined;
    } while (marker);
    return parts;
  }

  /** Each URL only allows PUTting that one part of that one upload, for an hour. */
  signPartUrls(video: Video, sessionId: string, partNumbers: number[]): Promise<PartUrl[]> {
    return Promise.all(
      partNumbers.map(async (partNumber) => ({
        partNumber,
        url: await getSignedUrl(
          this.s3,
          new UploadPartCommand({
            ...this.target(video),
            UploadId: sessionId,
            PartNumber: partNumber,
          }),
          { expiresIn: PART_URL_TTL_SECONDS },
        ),
      })),
    );
  }

  async completeMultipartUpload(
    video: Video,
    sessionId: string,
    parts: UploadedPart[],
  ): Promise<number> {
    try {
      await this.s3.send(
        new CompleteMultipartUploadCommand({
          ...this.target(video),
          UploadId: sessionId,
          MultipartUpload: {
            Parts: parts.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })),
          },
        }),
      );
    } catch (error) {
      // A retry after the parts were already joined: fall through and measure the object.
      if (!(error instanceof NoSuchUpload)) throw error;
    }
    const { ContentLength } = await this.s3.send(new HeadObjectCommand(this.target(video)));
    if (ContentLength === undefined) throw new Error('S3 did not return the object size');
    return ContentLength;
  }

  async abortMultipartUpload(video: Video, sessionId: string): Promise<void> {
    try {
      await this.s3.send(
        new AbortMultipartUploadCommand({ ...this.target(video), UploadId: sessionId }),
      );
    } catch (error) {
      if (!(error instanceof NoSuchUpload)) throw error;
    }
  }

  async deleteOriginal(video: Video): Promise<void> {
    await this.s3.send(new DeleteObjectCommand(this.target(video)));
  }

  // DeleteObject succeeds for a key that does not exist, so this is safe to repeat.
  async deletePlayable(video: Video): Promise<void> {
    await Promise.all(
      Object.values(mediaKeys(video.id)).map((Key) =>
        this.s3.send(new DeleteObjectCommand({ Bucket: this.mediaBucket, Key })),
      ),
    );
  }

  private target(video: Video) {
    return { Bucket: this.bucket, Key: originalKey(video) };
  }
}
