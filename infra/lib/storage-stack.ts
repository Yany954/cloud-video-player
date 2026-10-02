import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  HttpMethods,
  StorageClass,
  type BucketProps,
} from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

export interface StorageStackProps extends StackProps {
  /** Browser origins allowed to PUT upload parts directly to S3 (native apps don't need CORS). */
  webOrigins: string[];
}

// Videos are never public: no public access, HTTPS only, and they survive a stack deletion.
const privateBucket: BucketProps = {
  blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
  enforceSSL: true,
  encryption: BucketEncryption.S3_MANAGED,
  versioned: false,
  removalPolicy: RemovalPolicy.RETAIN,
};

const abortIncompleteUploads = {
  id: 'abort-incomplete-multipart',
  abortIncompleteMultipartUploadAfter: Duration.days(7),
};

export class StorageStack extends Stack {
  /** Originals as uploaded, under uploads/{userId}/{videoId}/. Backup only, never streamed. */
  readonly uploadsBucket: Bucket;
  /** Normalized MP4/HLS that the players stream (via CloudFront, added later). */
  readonly mediaBucket: Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    this.uploadsBucket = new Bucket(this, 'UploadsBucket', {
      ...privateBucket,
      cors: [
        {
          allowedMethods: [HttpMethods.PUT],
          allowedOrigins: props.webOrigins,
          allowedHeaders: ['*'],
          // The browser needs each part's ETag to complete the multipart upload.
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        abortIncompleteUploads,
        {
          // Counted from upload date. 30 days gives moderation time to delete rejected
          // videos before Deep Archive's 180-day minimum storage charge applies.
          id: 'originals-to-deep-archive',
          transitions: [
            { storageClass: StorageClass.DEEP_ARCHIVE, transitionAfter: Duration.days(30) },
          ],
        },
      ],
    });

    this.mediaBucket = new Bucket(this, 'MediaBucket', {
      ...privateBucket,
      lifecycleRules: [
        abortIncompleteUploads,
        {
          id: 'intelligent-tiering',
          transitions: [
            { storageClass: StorageClass.INTELLIGENT_TIERING, transitionAfter: Duration.days(0) },
          ],
        },
      ],
    });

    new CfnOutput(this, 'UploadsBucketName', { value: this.uploadsBucket.bucketName });
    new CfnOutput(this, 'MediaBucketName', { value: this.mediaBucket.bucketName });
  }
}
