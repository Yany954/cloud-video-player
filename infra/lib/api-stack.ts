import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import { CorsHttpMethod, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import type { ITableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
import type { IQueue } from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';
import { nodeLambda } from './node-lambda';

export interface ApiStackProps extends StackProps {
  prefix: string;
  userPool: UserPool;
  appClient: UserPoolClient;
  webOrigins: string[];
  table: ITableV2;
  uploadsBucket: IBucket;
  mediaBucket: IBucket;
  processingQueue: IQueue;
  /** CloudFront domain that serves processed videos. */
  playbackDomain: string;
  playbackKeyPairId: string;
  /** Name of the SSM SecureString holding the URL-signing private key. */
  playbackKeyParameter: string;
}

interface RouteProps {
  method: HttpMethod;
  path: string;
  /** Handler file in services/api/src/interfaces/http. */
  file: string;
  /** Least privilege: only the actions this one handler performs. */
  tableActions?: string[];
  uploadActions?: string[];
  /** May remove a video's playable version and poster from the media bucket. */
  deletesMedia?: boolean;
  /** May put jobs on the processing queue. */
  startsProcessing?: boolean;
  /** May read the private key that signs playback URLs. */
  signsPlaybackUrls?: boolean;
  timeout?: Duration;
}

export class ApiStack extends Stack {
  readonly httpApi: HttpApi;

  constructor(
    scope: Construct,
    id: string,
    private readonly props: ApiStackProps,
  ) {
    super(scope, id, props);

    // Every route requires a valid Cognito token unless it explicitly opts out.
    this.httpApi = new HttpApi(this, 'HttpApi', {
      apiName: `${props.prefix}-api`,
      defaultAuthorizer: new HttpUserPoolAuthorizer('CognitoAuthorizer', props.userPool, {
        userPoolClients: [props.appClient],
      }),
      corsPreflight: {
        allowOrigins: props.webOrigins,
        allowMethods: [CorsHttpMethod.ANY],
        allowHeaders: ['authorization', 'content-type'],
        maxAge: Duration.hours(1),
      },
      createDefaultStage: false,
    });

    // Caps the bill if a token is abused.
    const stage = this.httpApi.addStage('DefaultStage', {
      stageName: '$default',
      autoDeploy: true,
      throttle: { rateLimit: 20, burstLimit: 50 },
    });

    this.route('Health', { method: HttpMethod.GET, path: '/health', file: 'health.ts' });

    this.route('GetStorageUsage', {
      method: HttpMethod.GET,
      path: '/me/storage',
      file: 'get-storage-usage.ts',
      tableActions: ['dynamodb:GetItem'],
    });
    this.route('ListVideos', {
      method: HttpMethod.GET,
      path: '/videos',
      file: 'list-videos.ts',
      // Reads the "my videos" index (GSI1).
      tableActions: ['dynamodb:Query'],
      // Each ready video comes with a signed link to its poster.
      signsPlaybackUrls: true,
    });
    this.route('GetPlayback', {
      method: HttpMethod.GET,
      path: '/videos/{videoId}/playback',
      file: 'get-playback.ts',
      tableActions: ['dynamodb:GetItem'],
      signsPlaybackUrls: true,
    });
    this.route('DeleteVideo', {
      method: HttpMethod.DELETE,
      path: '/videos/{videoId}',
      file: 'delete-video.ts',
      // Removing the record and giving the bytes back is one transaction of these two writes.
      tableActions: ['dynamodb:GetItem', 'dynamodb:DeleteItem', 'dynamodb:UpdateItem'],
      uploadActions: ['s3:DeleteObject', 's3:AbortMultipartUpload'],
      deletesMedia: true,
    });
    this.route('ListLibrary', {
      method: HttpMethod.GET,
      path: '/library',
      file: 'list-library.ts',
      // Reads the approved videos in the moderation index (GSI3).
      tableActions: ['dynamodb:Query'],
      signsPlaybackUrls: true,
    });
    // The /admin routes check the caller's `admin` group inside the handler.
    this.route('ListReviewQueue', {
      method: HttpMethod.GET,
      path: '/admin/review',
      file: 'list-review-queue.ts',
      tableActions: ['dynamodb:Query'],
      signsPlaybackUrls: true,
    });
    this.route('ReviewVideo', {
      method: HttpMethod.POST,
      path: '/admin/videos/{videoId}/review',
      file: 'review-video.ts',
      tableActions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
    });
    this.route('InitiateUpload', {
      method: HttpMethod.POST,
      path: '/uploads',
      file: 'initiate-upload.ts',
      tableActions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
      // CreateMultipartUpload is authorized as s3:PutObject.
      uploadActions: ['s3:PutObject'],
    });
    this.route('GetPartUrls', {
      method: HttpMethod.GET,
      path: '/uploads/{videoId}/parts',
      file: 'get-part-urls.ts',
      tableActions: ['dynamodb:GetItem'],
      // A presigned UploadPart URL carries this role's s3:PutObject permission.
      uploadActions: ['s3:ListMultipartUploadParts', 's3:PutObject'],
    });
    this.route('CompleteUpload', {
      method: HttpMethod.POST,
      path: '/uploads/{videoId}/complete',
      file: 'complete-upload.ts',
      tableActions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
      ],
      uploadActions: [
        's3:ListMultipartUploadParts',
        's3:PutObject',
        's3:GetObject',
        's3:AbortMultipartUpload',
        's3:DeleteObject',
      ],
      startsProcessing: true,
      // Joining thousands of parts can be slow; stay just under API Gateway's 30 s limit.
      timeout: Duration.seconds(29),
    });
    this.route('AbortUpload', {
      method: HttpMethod.DELETE,
      path: '/uploads/{videoId}',
      file: 'abort-upload.ts',
      tableActions: ['dynamodb:GetItem', 'dynamodb:DeleteItem'],
      uploadActions: ['s3:AbortMultipartUpload'],
    });

    new CfnOutput(this, 'ApiUrl', { value: stage.url });
  }

  private route(name: string, route: RouteProps) {
    const { table, uploadsBucket, mediaBucket, processingQueue } = this.props;

    const fn = nodeLambda(this, name, {
      entry: `interfaces/http/${route.file}`,
      timeout: route.timeout,
      environment: {
        TABLE_NAME: table.tableName,
        UPLOADS_BUCKET: uploadsBucket.bucketName,
        MEDIA_BUCKET: mediaBucket.bucketName,
        PROCESSING_QUEUE_URL: processingQueue.queueUrl,
        PLAYBACK_DOMAIN: this.props.playbackDomain,
        PLAYBACK_KEY_PAIR_ID: this.props.playbackKeyPairId,
        PLAYBACK_KEY_PARAMETER: this.props.playbackKeyParameter,
      },
    });

    if (route.tableActions) table.grant(fn, ...route.tableActions);
    if (route.uploadActions) {
      fn.addToRolePolicy(
        new PolicyStatement({
          actions: route.uploadActions,
          resources: [uploadsBucket.arnForObjects('uploads/*')],
        }),
      );
    }
    if (route.deletesMedia) {
      fn.addToRolePolicy(
        new PolicyStatement({
          actions: ['s3:DeleteObject'],
          resources: [mediaBucket.arnForObjects('media/*')],
        }),
      );
    }
    if (route.startsProcessing) processingQueue.grantSendMessages(fn);
    if (route.signsPlaybackUrls) {
      fn.addToRolePolicy(
        new PolicyStatement({
          actions: ['ssm:GetParameter'],
          resources: [
            this.formatArn({
              service: 'ssm',
              resource: 'parameter',
              // Parameter names start with "/", which the ARN format already provides.
              resourceName: this.props.playbackKeyParameter.replace(/^\//, ''),
            }),
          ],
        }),
      );
    }

    this.httpApi.addRoutes({
      path: route.path,
      methods: [route.method],
      integration: new HttpLambdaIntegration(`${name}Integration`, fn),
    });
  }
}
