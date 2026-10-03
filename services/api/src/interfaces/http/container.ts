import { randomUUID } from 'node:crypto';
import { env } from '../env';
import { ListReviewQueue } from '../../application/moderation/list-review-queue';
import { ReviewVideo } from '../../application/moderation/review-video';
import { AbortUpload } from '../../application/upload/abort-upload';
import { CompleteUpload } from '../../application/upload/complete-upload';
import { GetPartUrls } from '../../application/upload/get-part-urls';
import { GetStorageUsage } from '../../application/upload/get-storage-usage';
import { InitiateUpload } from '../../application/upload/initiate-upload';
import { DeleteVideo } from '../../application/video/delete-video';
import { GetPlayback } from '../../application/video/get-playback';
import { ListLibrary } from '../../application/video/list-library';
import { ListMyVideos } from '../../application/video/list-my-videos';
import { documentClient, s3Client, sqsClient, ssmClient } from '../../infrastructure/aws-clients';
import { CloudFrontPlaybackSigner } from '../../infrastructure/cloudfront-playback-signer';
import { DynamoStorageAccountRepository } from '../../infrastructure/dynamo-storage-account-repository';
import { DynamoVideoRepository } from '../../infrastructure/dynamo-video-repository';
import { S3ObjectStorage } from '../../infrastructure/s3-object-storage';
import { SqsProcessingQueue } from '../../infrastructure/sqs-processing-queue';

// Composition root: the one place where use cases are wired to their AWS adapters.
const accounts = new DynamoStorageAccountRepository(documentClient, env('TABLE_NAME'));
const videos = new DynamoVideoRepository(documentClient, env('TABLE_NAME'), accounts);
const storage = new S3ObjectStorage(s3Client, env('UPLOADS_BUCKET'), env('MEDIA_BUCKET'));
const queue = new SqsProcessingQueue(sqsClient, env('PROCESSING_QUEUE_URL'));

export const initiateUpload = new InitiateUpload(
  videos,
  accounts,
  storage,
  randomUUID,
  () => new Date(),
);
export const getPartUrls = new GetPartUrls(videos, storage);
export const completeUpload = new CompleteUpload(videos, accounts, storage, queue);
export const abortUpload = new AbortUpload(videos, storage);
export const getStorageUsage = new GetStorageUsage(accounts);
export const listMyVideos = new ListMyVideos(videos);
export const deleteVideo = new DeleteVideo(videos, storage);
export const listLibrary = new ListLibrary(videos);
export const listReviewQueue = new ListReviewQueue(videos);
export const reviewVideo = new ReviewVideo(videos, () => new Date());

export const playbackSigner = new CloudFrontPlaybackSigner(ssmClient, {
  domain: env('PLAYBACK_DOMAIN'),
  keyPairId: env('PLAYBACK_KEY_PAIR_ID'),
  privateKeyParameter: env('PLAYBACK_KEY_PARAMETER'),
});
export const getPlayback = new GetPlayback(videos, playbackSigner, () => new Date());
