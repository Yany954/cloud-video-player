import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { CorsHttpMethod, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import {
  NodejsFunction,
  OutputFormat,
  type NodejsFunctionProps,
} from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

export interface ApiStackProps extends StackProps {
  prefix: string;
  userPool: UserPool;
  appClient: UserPoolClient;
  webOrigins: string[];
}

const handlersDir = fileURLToPath(
  new URL('../../services/api/src/interfaces/http/', import.meta.url),
);

export class ApiStack extends Stack {
  readonly httpApi: HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
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

    const health = this.lambda('Health', 'health.ts');
    this.httpApi.addRoutes({
      path: '/health',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('HealthIntegration', health),
    });

    new CfnOutput(this, 'ApiUrl', { value: stage.url });
  }

  private lambda(name: string, file: string, props: Partial<NodejsFunctionProps> = {}) {
    return new NodejsFunction(this, name, {
      entry: handlersDir + file,
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(10),
      bundling: { format: OutputFormat.ESM, minify: true, sourceMap: true },
      logGroup: new LogGroup(this, `${name}Logs`, {
        retention: RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      ...props,
    });
  }
}
