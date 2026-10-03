import { DomainError } from './errors';

const MIB = 1024 ** 2;

// Multipart limits of the object store: at most 10,000 parts and 5 TiB per object.
export const MAX_PARTS = 10_000;
export const MAX_FILE_BYTES = 5 * 1024 ** 4;
// Small enough that a failed part on mobile data loses little, large enough to keep requests low.
export const MIN_PART_BYTES = 16 * MIB;

export interface UploadPlan {
  partSizeBytes: number;
  partCount: number;
}

export function planUpload(sizeBytes: number): UploadPlan {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_FILE_BYTES) {
    throw new DomainError('INVALID_SIZE', `File size must be between 1 byte and 5 TiB`);
  }
  // Grow parts (in whole MiB) only when 16 MiB parts would need more than 10,000 of them.
  const neededMib = Math.ceil(sizeBytes / MAX_PARTS / MIB);
  const partSizeBytes = Math.max(MIN_PART_BYTES, neededMib * MIB);
  return { partSizeBytes, partCount: Math.ceil(sizeBytes / partSizeBytes) };
}
