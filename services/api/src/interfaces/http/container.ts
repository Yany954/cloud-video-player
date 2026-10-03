import { randomUUID } from 'node:crypto';
import { AbortUpload } from '../../application/upload/abort-upload';
import { CompleteUpload } from '../../application/upload/complete-upload';
import { GetPartUrls } from '../../application/upload/get-part-urls';
import { GetStorageUsage } from '../../application/upload/get-storage-usage';
import { InitiateUpload } from '../../application/upload/initiate-upload';
import { documentClient, s3Client } from '../../infrastructure/aws-clients';
import { DynamoStorageAccountRepository } from '../../infrastructure/dynamo-storage-account-repository';
import { DynamoVideoRepository } from '../../infrastructure/dynamo-video-repository';
import { S3ObjectStorage } from '../../infrastructure/s3-object-storage';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

// Composition root: the one place where use cases are wired to their AWS adapters.
const accounts = new DynamoStorageAccountRepository(documentClient, env('TABLE_NAME'));
const videos = new DynamoVideoRepository(documentClient, env('TABLE_NAME'), accounts);
const storage = new S3ObjectStorage(s3Client, env('UPLOADS_BUCKET'));

export const initiateUpload = new InitiateUpload(
  videos,
  accounts,
  storage,
  randomUUID,
  () => new Date(),
);
export const getPartUrls = new GetPartUrls(videos, storage);
export const completeUpload = new CompleteUpload(videos, accounts, storage);
export const abortUpload = new AbortUpload(videos, storage);
export const getStorageUsage = new GetStorageUsage(accounts);
