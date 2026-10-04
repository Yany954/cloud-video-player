import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, Size, Stack, type StackProps } from 'aws-cdk-lib';
import type { IUserPool } from 'aws-cdk-lib/aws-cognito';
import type { ITableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, Code, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';
import { nodeLambda } from './node-lambda';

export interface ProcessingStackProps extends StackProps {
  prefix: string;
  table: ITableV2;
  uploadsBucket: IBucket;
  mediaBucket: IBucket;
  userPool: IUserPool;
  /** Tests build the template without the ~100 MB ffmpeg binaries. Never set when deploying. */
  allowMissingFfmpeg?: boolean;
  /** Folder holding bin/ffmpeg and bin/ffprobe. Defaults to infra/layers/ffmpeg. */
  ffmpegLayerDir?: string;
}

const defaultFfmpegLayerDir = fileURLToPath(new URL('../layers/ffmpeg', import.meta.url));
const MAX_ATTEMPTS = 3;
const PROCESSING_TIMEOUT = Duration.minutes(15);

/** Turns uploaded originals into playable MP4s, one queue message per video. */
export class ProcessingStack extends Stack {
  readonly queue: Queue;
  /** One message per account to delete, with everything it owns. */
  readonly deletionQueue: Queue;

  constructor(scope: Construct, id: string, props: ProcessingStackProps) {
    super(scope, id, props);

    const ffmpegLayerDir = props.ffmpegLayerDir ?? defaultFfmpegLayerDir;
    if (!props.allowMissingFfmpeg && !existsSync(`${ffmpegLayerDir}/bin/ffmpeg`)) {
      throw new Error('ffmpeg layer is missing. Run: pnpm --filter @cvp/infra fetch:ffmpeg');
    }

    // Jobs that fail every attempt wait here for a person to look at them.
    const deadLetterQueue = new Queue(this, 'DeadLetterQueue', {
      queueName: `${props.prefix}-processing-dlq`,
      retentionPeriod: Duration.days(14),
      encryption: QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
    });

    this.queue = new Queue(this, 'Queue', {
      queueName: `${props.prefix}-processing`,
      // A message stays hidden while a Lambda works on it; it must outlast the longest job.
      visibilityTimeout: PROCESSING_TIMEOUT.plus(Duration.minutes(1)),
      deadLetterQueue: { queue: deadLetterQueue, maxReceiveCount: MAX_ATTEMPTS },
      encryption: QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
    });

    const ffmpegLayer = new LayerVersion(this, 'FfmpegLayer', {
      code: Code.fromAsset(ffmpegLayerDir),
      compatibleArchitectures: [Architecture.ARM_64],
      description: 'Static ffmpeg and ffprobe 7.0.2 (arm64)',
    });

    const processor = nodeLambda(this, 'Processor', {
      entry: 'interfaces/queue/process-video.ts',
      layers: [ffmpegLayer],
      // ffmpeg copies streams, so CPU matters little; memory mostly buys network speed.
      memorySize: 2048,
      timeout: PROCESSING_TIMEOUT,
      // The playable copy is written here before it is uploaded: this caps the file size.
      ephemeralStorageSize: Size.gibibytes(10),
      environment: {
        TABLE_NAME: props.table.tableName,
        UPLOADS_BUCKET: props.uploadsBucket.bucketName,
        MEDIA_BUCKET: props.mediaBucket.bucketName,
        MAX_ATTEMPTS: String(MAX_ATTEMPTS),
      },
    });

    processor.addEventSource(
      new SqsEventSource(this.queue, {
        batchSize: 1,
        // At most two videos are processed at once, which also caps the cost of a burst.
        maxConcurrency: 2,
        reportBatchItemFailures: true,
      }),
    );

    props.table.grant(processor, 'dynamodb:GetItem', 'dynamodb:PutItem');
    processor.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [props.uploadsBucket.arnForObjects('uploads/*')],
      }),
    );
    processor.addToRolePolicy(
      new PolicyStatement({
        // Large outputs are uploaded in parts; a failed upload must be able to clean up.
        actions: ['s3:PutObject', 's3:AbortMultipartUpload'],
        resources: [props.mediaBucket.arnForObjects('media/*')],
      }),
    );

    // Deleting an account: every video, file, event and record of one person, then the
    // sign-in account. Runs here, not in the API, because it can take minutes.
    const deletionTimeout = Duration.minutes(10);
    const deletionDeadLetterQueue = new Queue(this, 'DeletionDeadLetterQueue', {
      queueName: `${props.prefix}-account-deletion-dlq`,
      retentionPeriod: Duration.days(14),
      encryption: QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
    });
    this.deletionQueue = new Queue(this, 'DeletionQueue', {
      queueName: `${props.prefix}-account-deletion`,
      // Also the wait before a retry, e.g. for a video that was still being processed.
      visibilityTimeout: deletionTimeout.plus(Duration.minutes(1)),
      deadLetterQueue: { queue: deletionDeadLetterQueue, maxReceiveCount: MAX_ATTEMPTS },
      encryption: QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
    });

    const deleter = nodeLambda(this, 'AccountDeleter', {
      entry: 'interfaces/queue/delete-account.ts',
      timeout: deletionTimeout,
      environment: {
        TABLE_NAME: props.table.tableName,
        UPLOADS_BUCKET: props.uploadsBucket.bucketName,
        MEDIA_BUCKET: props.mediaBucket.bucketName,
        USER_POOL_ID: props.userPool.userPoolId,
      },
    });
    deleter.addEventSource(
      new SqsEventSource(this.deletionQueue, { batchSize: 1, reportBatchItemFailures: true }),
    );
    props.table.grant(
      deleter,
      'dynamodb:GetItem',
      'dynamodb:BatchGetItem',
      'dynamodb:Query',
      'dynamodb:PutItem',
      'dynamodb:UpdateItem',
      'dynamodb:DeleteItem',
    );
    deleter.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:DeleteObject', 's3:AbortMultipartUpload'],
        resources: [props.uploadsBucket.arnForObjects('uploads/*')],
      }),
    );
    deleter.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:DeleteObject'],
        resources: [props.mediaBucket.arnForObjects('media/*')],
      }),
    );
    deleter.addToRolePolicy(
      new PolicyStatement({
        // The only function anywhere that may delete a sign-in account.
        actions: ['cognito-idp:ListUsers', 'cognito-idp:AdminDeleteUser'],
        resources: [props.userPool.userPoolArn],
      }),
    );

    new CfnOutput(this, 'DeletionQueueUrl', { value: this.deletionQueue.queueUrl });
    new CfnOutput(this, 'QueueUrl', { value: this.queue.queueUrl });
    new CfnOutput(this, 'DeadLetterQueueUrl', { value: deadLetterQueue.queueUrl });
  }
}
