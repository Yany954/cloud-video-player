import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { ProcessVideo } from '../../application/processing/process-video';
import { documentClient, s3Client } from '../../infrastructure/aws-clients';
import { DynamoStorageAccountRepository } from '../../infrastructure/dynamo-storage-account-repository';
import { DynamoVideoRepository } from '../../infrastructure/dynamo-video-repository';
import { FfmpegMediaProcessor } from '../../infrastructure/ffmpeg-media-processor';
import type { ProcessingMessage } from '../../infrastructure/sqs-processing-queue';
import { env } from '../env';

const videos = new DynamoVideoRepository(
  documentClient,
  env('TABLE_NAME'),
  new DynamoStorageAccountRepository(documentClient, env('TABLE_NAME')),
);
const processVideo = new ProcessVideo(
  videos,
  new FfmpegMediaProcessor(s3Client, {
    uploadsBucket: env('UPLOADS_BUCKET'),
    mediaBucket: env('MEDIA_BUCKET'),
  }),
);
// Must match the queue's maxReceiveCount: after this many tries the message is parked.
const maxAttempts = Number(env('MAX_ATTEMPTS'));

// Triggered by the processing queue, one video per message.
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const failures: SQSBatchResponse['batchItemFailures'] = [];
  for (const record of event.Records) {
    const { videoId } = JSON.parse(record.body) as ProcessingMessage;
    const attempt = Number(record.attributes.ApproximateReceiveCount);
    try {
      await processVideo.execute({ videoId, isLastAttempt: attempt >= maxAttempts });
      console.log(JSON.stringify({ videoId, attempt, outcome: 'done' }));
    } catch (error) {
      console.error(JSON.stringify({ videoId, attempt, outcome: 'error' }), error);
      // Only this message goes back to the queue, not the whole batch.
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures: failures };
}
