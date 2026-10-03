import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { CorsHttpMethod, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import type { ITableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

export interface ApiStackProps extends StackProps {
  prefix: string;
  userPool: UserPool;
  appClient: UserPoolClient;
  webOrigins: string[];
  table: ITableV2;
  uploadsBucket: IBucket;
}

interface RouteProps {
  method: HttpMethod;
  path: string;
  /** Handler file in services/api/src/interfaces/http. */
  file: string;
  /** Least privilege: only the actions this one handler performs. */
  tableActions?: string[];
  uploadActions?: string[];
  timeout?: Duration;
}

const handlersDir = fileURLToPath(
  new URL('../../services/api/src/interfaces/http/', import.meta.url),
);

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
    const { table, uploadsBucket } = this.props;

    const fn = new NodejsFunction(this, name, {
      entry: handlersDir + route.file,
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      timeout: route.timeout ?? Duration.seconds(10),
      environment: { TABLE_NAME: table.tableName, UPLOADS_BUCKET: uploadsBucket.bucketName },
      bundling: {
        format: OutputFormat.ESM,
        minify: true,
        sourceMap: true,
        mainFields: ['module', 'main'],
        // Ship the AWS SDK version we test with instead of whatever the runtime has.
        externalModules: [],
        // Some dependencies still call require(), which ESM output doesn't define.
        banner:
          "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
      },
      logGroup: new LogGroup(this, `${name}Logs`, {
        retention: RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
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

    this.httpApi.addRoutes({
      path: route.path,
      methods: [route.method],
      integration: new HttpLambdaIntegration(`${name}Integration`, fn),
    });
  }
}
