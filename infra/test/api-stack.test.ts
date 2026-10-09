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
    const auth = new AuthStack(app, 'TestAuth', { prefix: 'test', webUrl: 'https://app.test' });
    const data = new DataStack(app, 'TestData', { prefix: 'test' });
    const storage = new StorageStack(app, 'TestStorage', { webOrigins });
    const processing = new ProcessingStack(app, 'TestProcessing', {
      prefix: 'test',
      table: data.table,
      uploadsBucket: storage.uploadsBucket,
      mediaBucket: storage.mediaBucket,
      userPool: auth.userPool,
      allowMissingFfmpeg: true,
    });
    const api = new ApiStack(app, 'TestApi', {
      prefix: 'test',
      webOrigins,
      userPool: auth.userPool,
      appClient: auth.appClient,
      table: data.table,
      uploadsBucket: storage.uploadsBucket,
      mediaBucket: storage.mediaBucket,
      processingQueue: processing.queue,
      deletionQueue: processing.deletionQueue,
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
      'DELETE /admin/users/{userId}',
      'DELETE /events/{eventId}',
      'DELETE /events/{eventId}/collaborators/{userId}',
      'DELETE /events/{eventId}/invite',
      'DELETE /me/blocks/{userId}',
      'DELETE /uploads/{videoId}',
      'DELETE /videos/{videoId}',
      'GET /admin/review',
      'GET /admin/users',
      'GET /events',
      'GET /events/{eventId}',
      'GET /health',
      'GET /library',
      'GET /me/blocks',
      'GET /me/storage',
      'GET /uploads/{videoId}/parts',
      'GET /videos',
      'GET /videos/{videoId}/playback',
      'PATCH /admin/users/{userId}',
      'PATCH /events/{eventId}',
      'POST /admin/users',
      'POST /admin/videos/{videoId}/review',
      'POST /events',
      'POST /events/{eventId}/join',
      'POST /me/blocks',
      'POST /me/deletion',
      'POST /uploads',
      'POST /uploads/{videoId}/complete',
      'POST /videos/{videoId}/reports',
      'PUT /events/{eventId}/invite',
      'PUT /events/{eventId}/order',
      'PUT /videos/{videoId}/event',
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
    expect(functions).toHaveLength(32);
    for (const fn of functions) {
      expect(fn.Properties).toMatchObject({ Runtime: 'nodejs22.x', Architectures: ['arm64'] });
    }
    const logGroups = Object.values(template.findResources('AWS::Logs::LogGroup'));
    expect(logGroups).toHaveLength(32);
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

    it('lets "playback" only read (one video, the caller\'s blocks) and sign links', () => {
      expect(actionsOf('GetPlayback')).toEqual([
        'dynamodb:GetItem',
        'dynamodb:Query',
        'ssm:GetParameter',
      ]);
    });

    it('lets "Shared with me" read the caller’s events and their videos, and sign poster links', () => {
      expect(actionsOf('ListLibrary')).toEqual([
        'dynamodb:BatchGetItem',
        'dynamodb:Query',
        'ssm:GetParameter',
      ]);
      expect(actionsOf('ListReviewQueue')).toEqual([
        'cognito-idp:ListUsers',
        'dynamodb:Query',
        'ssm:GetParameter',
      ]);
    });

    it('gives reporting and blocking only the table actions they perform, and no files', () => {
      expect(actionsOf('ReportVideo')).toEqual([
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
      ]);
      expect(actionsOf('BlockUploader')).toEqual([
        'dynamodb:DeleteItem',
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:Query',
      ]);
      expect(actionsOf('ListBlocks')).toEqual(['dynamodb:Query']);
      expect(actionsOf('Unblock')).toEqual(['dynamodb:DeleteItem']);
    });

    it('lets "review" only read and rewrite one video: no delete, no files, no key', () => {
      expect(actionsOf('ReviewVideo')).toEqual(['dynamodb:GetItem', 'dynamodb:UpdateItem']);
    });

    it('lets only the five signing routes read the private key, and only that parameter', () => {
      for (const name of [
        'InitiateUpload',
        'GetPartUrls',
        'CompleteUpload',
        'AbortUpload',
        'ReviewVideo',
      ]) {
        expect(actionsOf(name)).not.toContain('ssm:GetParameter');
      }
      const ssm = Object.values(template.findResources('AWS::IAM::Policy'))
        .flatMap((policy) => policy.Properties.PolicyDocument.Statement as Statement[])
        .filter((statement) => [statement.Action].flat().includes('ssm:GetParameter'));
      expect(ssm).toHaveLength(5);
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
      for (const name of [
        'InitiateUpload',
        'GetPartUrls',
        'AbortUpload',
        'ListVideos',
        'ReviewVideo',
      ]) {
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

    it('gives each event route only the table actions it performs, and no file access', () => {
      expect(actionsOf('CreateEvent')).toEqual(['dynamodb:PutItem']);
      expect(actionsOf('ListEvents')).toEqual(['dynamodb:BatchGetItem', 'dynamodb:Query']);
      expect(actionsOf('GetEvent')).toEqual([
        'cognito-idp:ListUsers',
        'dynamodb:BatchGetItem',
        'dynamodb:GetItem',
        'dynamodb:Query',
        'ssm:GetParameter',
      ]);
      expect(actionsOf('UpdateEvent')).toEqual([
        'dynamodb:BatchGetItem',
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:Query',
        'dynamodb:UpdateItem',
      ]);
      expect(actionsOf('ReorderEvent')).toEqual(['dynamodb:GetItem', 'dynamodb:PutItem']);
      expect(actionsOf('DeleteEvent')).toEqual([
        'dynamodb:BatchGetItem',
        'dynamodb:DeleteItem',
        'dynamodb:GetItem',
        'dynamodb:Query',
      ]);
      expect(actionsOf('SetVideoEvent')).toEqual(['dynamodb:GetItem', 'dynamodb:UpdateItem']);
    });

    it('gives the invite routes only the table writes they perform', () => {
      for (const name of ['OpenInvite', 'CloseInvite']) {
        expect(actionsOf(name)).toEqual(['dynamodb:GetItem', 'dynamodb:PutItem']);
      }
      expect(actionsOf('JoinEvent')).toEqual([
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:Query',
        'dynamodb:UpdateItem',
      ]);
      expect(actionsOf('RemoveCollaborator')).toEqual([
        'dynamodb:DeleteItem',
        'dynamodb:GetItem',
        'dynamodb:PutItem',
      ]);
    });

    it('gives user-pool access only to seven routes, each only what it does, in our pool', () => {
      const cognito = Object.entries(template.findResources('AWS::IAM::Policy')).flatMap(
        ([id, policy]) =>
          (policy.Properties.PolicyDocument.Statement as Statement[])
            .filter((statement) => [statement.Action].flat().some((a) => a.startsWith('cognito')))
            .map((statement) => ({
              route: id.replace(/ServiceRoleDefaultPolicy.*/, ''),
              actions: [statement.Action].flat().sort(),
              resource: JSON.stringify(statement.Resource),
            })),
      );

      expect(Object.fromEntries(cognito.map(({ route, actions }) => [route, actions]))).toEqual({
        GetEvent: ['cognito-idp:ListUsers'],
        ListReviewQueue: ['cognito-idp:ListUsers'],
        ListUsers: ['cognito-idp:ListUsers', 'cognito-idp:ListUsersInGroup'],
        InviteUser: ['cognito-idp:AdminCreateUser'],
        DeleteMyAccount: [
          'cognito-idp:AdminDisableUser',
          'cognito-idp:AdminInitiateAuth',
          'cognito-idp:AdminListGroupsForUser',
          'cognito-idp:AdminUserGlobalSignOut',
          'cognito-idp:ListUsers',
          'cognito-idp:ListUsersInGroup',
        ],
        DeleteUser: [
          'cognito-idp:AdminDisableUser',
          'cognito-idp:AdminListGroupsForUser',
          'cognito-idp:AdminUserGlobalSignOut',
          'cognito-idp:ListUsers',
          'cognito-idp:ListUsersInGroup',
        ],
        UpdateUser: [
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminDisableUser',
          'cognito-idp:AdminEnableUser',
          'cognito-idp:AdminListGroupsForUser',
          'cognito-idp:AdminRemoveUserFromGroup',
          'cognito-idp:AdminUserGlobalSignOut',
          'cognito-idp:ListUsers',
        ],
      });
      for (const { resource } of cognito) expect(resource).toContain('UserPool');
    });

    it('lets the two deletion routes only suspend and queue: no table, no files', () => {
      for (const name of ['DeleteMyAccount', 'DeleteUser']) {
        const actions = actionsOf(name);
        expect(actions).toContain('sqs:SendMessage');
        expect(actions.filter((action) => /^(dynamodb|s3):/.test(action))).toEqual([]);
      }
    });

    it('never lets a route delete a user or read or set a password', () => {
      const actions = Object.values(template.findResources('AWS::IAM::Policy'))
        .flatMap((policy) => policy.Properties.PolicyDocument.Statement as Statement[])
        .flatMap((statement) => statement.Action);

      for (const action of actions) {
        expect(action).not.toMatch(/AdminDeleteUser|AdminSetUserPassword|AdminGetUser/);
      }
    });

    it('lets "delete video" remove one record, give bytes back and delete files only', () => {
      expect(actionsOf('DeleteVideo')).toEqual([
        'dynamodb:BatchWriteItem',
        'dynamodb:DeleteItem',
        'dynamodb:GetItem',
        'dynamodb:Query',
        'dynamodb:UpdateItem',
        's3:AbortMultipartUpload',
        's3:DeleteObject',
        's3:DeleteObject',
      ]);
    });

    it('lets only "delete video" touch the media bucket, and only to delete under media/', () => {
      const policies = template.findResources('AWS::IAM::Policy');
      const media = Object.entries(policies).flatMap(([id, policy]) =>
        (policy.Properties.PolicyDocument.Statement as Statement[])
          .filter((statement) => JSON.stringify(statement.Resource).includes('/media/*'))
          .map((statement) => ({ id, actions: [statement.Action].flat() })),
      );

      expect(media).toHaveLength(1);
      expect(media[0]!.id).toMatch(/^DeleteVideoServiceRoleDefaultPolicy/);
      expect(media[0]!.actions).toEqual(['s3:DeleteObject']);
    });

    it('never grants wildcard actions, and limits S3 to the uploads/ and media/ prefixes', () => {
      const statements = Object.values(template.findResources('AWS::IAM::Policy')).flatMap(
        (policy) => policy.Properties.PolicyDocument.Statement as Statement[],
      );

      for (const statement of statements) {
        for (const action of [statement.Action].flat()) expect(action).not.toContain('*');
        if ([statement.Action].flat().some((action) => action.startsWith('s3:'))) {
          expect(JSON.stringify(statement.Resource)).toMatch(/\/(uploads|media)\/\*/);
        }
      }
    });
  });
});
