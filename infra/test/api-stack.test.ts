import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { ApiStack } from '../lib/api-stack';
import { AuthStack } from '../lib/auth-stack';
import { DataStack } from '../lib/data-stack';
import { ProcessingStack } from '../lib/processing-stack';
import { StorageStack } from '../lib/storage-stack';

interface Statement {
  Action: string | string[];
  Resource: unknown;
}

describe('ApiStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const webOrigins = ['http://localhost:3000'];
    const auth = new AuthStack(app, 'TestAuth', { prefix: 'test' });
    const data = new DataStack(app, 'TestData', { prefix: 'test' });
    const storage = new StorageStack(app, 'TestStorage', { webOrigins });
    const processing = new ProcessingStack(app, 'TestProcessing', {
      prefix: 'test',
      table: data.table,
      uploadsBucket: storage.uploadsBucket,
      mediaBucket: storage.mediaBucket,
      allowMissingFfmpeg: true,
    });
    const api = new ApiStack(app, 'TestApi', {
      prefix: 'test',
      webOrigins,
      userPool: auth.userPool,
      appClient: auth.appClient,
      table: data.table,
      uploadsBucket: storage.uploadsBucket,
      processingQueue: processing.queue,
      playbackDomain: storage.mediaDistribution.distributionDomainName,
      playbackKeyPairId: storage.playbackKeyPairId,
      playbackKeyParameter: '/test/playback/private-key',
    });
    template = Template.fromStack(api);
  }, 120_000);

  /** Actions granted to the Lambda whose role's logical id starts with `name`. */
  const actionsOf = (name: string) => {
    const policies = template.findResources('AWS::IAM::Policy');
    return Object.entries(policies)
      .filter(([id]) => id.startsWith(`${name}ServiceRoleDefaultPolicy`))
      .flatMap(([, policy]) => policy.Properties.PolicyDocument.Statement as Statement[])
      .flatMap((statement) => statement.Action)
      .sort();
  };

  it('validates Cognito JWTs', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerType: 'JWT',
      IdentitySource: ['$request.header.Authorization'],
    });
  });

  it('exposes exactly the expected routes, all behind the authorizer', () => {
    const routes = Object.values(template.findResources('AWS::ApiGatewayV2::Route'));

    expect(routes.map((route) => route.Properties.RouteKey).sort()).toEqual([
      'DELETE /uploads/{videoId}',
      'GET /health',
      'GET /me/storage',
      'GET /uploads/{videoId}/parts',
      'GET /videos',
      'GET /videos/{videoId}/playback',
      'POST /uploads',
      'POST /uploads/{videoId}/complete',
    ]);
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

  it('runs every Lambda on Node 22 ARM with 2-week logs', () => {
    const functions = Object.values(template.findResources('AWS::Lambda::Function'));
    expect(functions).toHaveLength(8);
    for (const fn of functions) {
      expect(fn.Properties).toMatchObject({ Runtime: 'nodejs22.x', Architectures: ['arm64'] });
    }
    const logGroups = Object.values(template.findResources('AWS::Logs::LogGroup'));
    expect(logGroups).toHaveLength(8);
    for (const logGroup of logGroups) expect(logGroup.Properties.RetentionInDays).toBe(14);
  });

  describe('least privilege', () => {
    it('gives the health check no data access at all', () => {
      expect(actionsOf('Health')).toEqual([]);
    });

    it('lets the storage widget only read one item', () => {
      expect(actionsOf('GetStorageUsage')).toEqual(['dynamodb:GetItem']);
    });

    it('lets "my videos" only query and sign poster links, never write', () => {
      expect(actionsOf('ListVideos')).toEqual(['dynamodb:Query', 'ssm:GetParameter']);
    });

    it('lets "playback" only read one video and sign its links', () => {
      expect(actionsOf('GetPlayback')).toEqual(['dynamodb:GetItem', 'ssm:GetParameter']);
    });

    it('lets only the two signing routes read the private key, and only that parameter', () => {
      for (const name of ['InitiateUpload', 'GetPartUrls', 'CompleteUpload', 'AbortUpload']) {
        expect(actionsOf(name)).not.toContain('ssm:GetParameter');
      }
      const ssm = Object.values(template.findResources('AWS::IAM::Policy'))
        .flatMap((policy) => policy.Properties.PolicyDocument.Statement as Statement[])
        .filter((statement) => [statement.Action].flat().includes('ssm:GetParameter'));
      expect(ssm).toHaveLength(2);
      for (const statement of ssm) {
        expect(JSON.stringify(statement.Resource)).toContain('parameter/test/playback/private-key');
      }
    });

    it('lets "initiate" create records and start uploads, nothing else', () => {
      expect(actionsOf('InitiateUpload')).toEqual([
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        's3:PutObject',
      ]);
    });

    it('lets "part URLs" read, list parts and sign uploads, but never write the table', () => {
      expect(actionsOf('GetPartUrls')).toEqual([
        'dynamodb:GetItem',
        's3:ListMultipartUploadParts',
        's3:PutObject',
      ]);
    });

    it('lets only "complete" put jobs on the processing queue', () => {
      expect(actionsOf('CompleteUpload')).toContain('sqs:SendMessage');
      for (const name of ['InitiateUpload', 'GetPartUrls', 'AbortUpload', 'ListVideos']) {
        expect(actionsOf(name).filter((action) => action.startsWith('sqs:'))).toEqual([]);
      }
    });

    it('lets "abort" only discard an upload and its record', () => {
      expect(actionsOf('AbortUpload')).toEqual([
        'dynamodb:DeleteItem',
        'dynamodb:GetItem',
        's3:AbortMultipartUpload',
      ]);
    });

    it('never grants wildcard actions, and limits S3 to the uploads/ prefix', () => {
      const statements = Object.values(template.findResources('AWS::IAM::Policy')).flatMap(
        (policy) => policy.Properties.PolicyDocument.Statement as Statement[],
      );

      for (const statement of statements) {
        for (const action of [statement.Action].flat()) expect(action).not.toContain('*');
        if ([statement.Action].flat().some((action) => action.startsWith('s3:'))) {
          expect(JSON.stringify(statement.Resource)).toContain('/uploads/*');
        }
      }
    });
  });
});
