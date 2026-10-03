import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  HttpVersion,
  KeyGroup,
  PriceClass,
  PublicKey,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
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

// The matching private key lives in SSM (see infra/scripts/create-playback-key.sh).
const playbackPublicKey = fileURLToPath(
  new URL('../keys/playback-public-key.pem', import.meta.url),
);

const abortIncompleteUploads = {
  id: 'abort-incomplete-multipart',
  abortIncompleteMultipartUploadAfter: Duration.days(7),
};

export class StorageStack extends Stack {
  /** Originals as uploaded, under uploads/{userId}/{videoId}/. Backup only, never streamed. */
  readonly uploadsBucket: Bucket;
  /** Processed, playable versions. Private: read only through `mediaDistribution`. */
  readonly mediaBucket: Bucket;
  /** Streams the media bucket, only to requests carrying a URL signed with our key. */
  readonly mediaDistribution: Distribution;
  /** Id of the public key CloudFront checks signatures against. */
  readonly playbackKeyPairId: string;

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

    const publicKey = new PublicKey(this, 'PlaybackPublicKey', {
      encodedKey: readFileSync(playbackPublicKey, 'utf8'),
    });
    this.playbackKeyPairId = publicKey.publicKeyId;

    // Lives in this stack because the bucket's policy must name the distribution, and the
    // distribution must name the bucket: in separate stacks they would depend on each other.
    this.mediaDistribution = new Distribution(this, 'MediaDistribution', {
      comment: 'Signed playback of processed videos',
      defaultBehavior: {
        // Origin access control: the bucket stays private and accepts only this distribution.
        origin: S3BucketOrigin.withOriginAccessControl(this.mediaBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        // Without a valid signature CloudFront answers 403, whatever the path.
        trustedKeyGroups: [new KeyGroup(this, 'PlaybackKeyGroup', { items: [publicKey] })],
      },
      // North America and Europe edges only: the cheapest class.
      priceClass: PriceClass.PRICE_CLASS_100,
      httpVersion: HttpVersion.HTTP2_AND_3,
    });

    new CfnOutput(this, 'MediaDomain', { value: this.mediaDistribution.distributionDomainName });
    new CfnOutput(this, 'UploadsBucketName', { value: this.uploadsBucket.bucketName });
    new CfnOutput(this, 'MediaBucketName', { value: this.mediaBucket.bucketName });
  }
}
