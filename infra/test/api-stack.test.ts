import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { ApiStack } from '../lib/api-stack';
import { AuthStack } from '../lib/auth-stack';

describe('ApiStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const auth = new AuthStack(app, 'TestAuth', { prefix: 'test' });
    const api = new ApiStack(app, 'TestApi', {
      prefix: 'test',
      webOrigins: ['http://localhost:3000'],
      userPool: auth.userPool,
      appClient: auth.appClient,
    });
    template = Template.fromStack(api);
  }, 60_000);

  it('validates Cognito JWTs on GET /health', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerType: 'JWT',
      IdentitySource: ['$request.header.Authorization'],
    });
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'GET /health',
      AuthorizationType: 'JWT',
    });
  });

  it('protects every route', () => {
    const routes = Object.values(template.findResources('AWS::ApiGatewayV2::Route'));
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) expect(route.Properties.AuthorizationType).toBe('JWT');
  });

  it('throttles the default stage', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      StageName: '$default',
      DefaultRouteSettings: { ThrottlingRateLimit: 20, ThrottlingBurstLimit: 50 },
    });
  });

  it('allows CORS only from the web origins', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      CorsConfiguration: Match.objectLike({ AllowOrigins: ['http://localhost:3000'] }),
    });
  });

  it('runs Lambdas on Node 22 ARM with 2-week logs', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x',
      Architectures: ['arm64'],
    });
    template.hasResourceProperties('AWS::Logs::LogGroup', { RetentionInDays: 14 });
  });
});
