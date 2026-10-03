import { z } from 'zod';

// Request/response contracts of the upload API, shared by api, web and mobile.

export const initiateUploadRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  title: z.string().min(1).max(200).optional(),
  /** Puts the video straight into one of the uploader's events. */
  eventId: z.string().min(1).optional(),
});
export type InitiateUploadRequest = z.infer<typeof initiateUploadRequestSchema>;

export interface InitiateUploadResponse {
  videoId: string;
  partSizeBytes: number;
  partCount: number;
}

export interface PartUrlsResponse {
  partSizeBytes: number;
  partCount: number;
  /** Parts the server already has; a resumed upload skips them. */
  uploadedPartNumbers: number[];
  /** PUT each part's bytes to its URL. At most 100 per response; ask again for more. */
  urls: { partNumber: number; url: string }[];
}

export interface StorageUsageResponse {
  bytesUsed: number;
  quotaBytes: number;
}

export interface ApiErrorResponse {
  error: { code: string; message: string };
}
