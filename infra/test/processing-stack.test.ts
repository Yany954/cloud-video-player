import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { AuthStack } from '../lib/auth-stack';
import { DataStack } from '../lib/data-stack';
import { ProcessingStack } from '../lib/processing-stack';
import { StorageStack } from '../lib/storage-stack';

interface Statement {
  Action: string | string[];
  Resource: unknown;
}

describe('ProcessingStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const data = new DataStack(app, 'TestData', { prefix: 'test' });
    const storage = new StorageStack(app, 'TestStorage', { webOrigins: [] });
    template = Template.fromStack(
      new ProcessingStack(app, 'TestProcessing', {
        prefix: 'test',
        table: data.table,
        uploadsBucket: storage.uploadsBucket,
        mediaBucket: storage.mediaBucket,
        userPool: new AuthStack(app, 'TestAuth', { prefix: 'test' }).userPool,
        allowMissingFfmpeg: true,
      }),
    );
  }, 120_000);

  /** Statements of the function whose role's logical id starts with `name`; all if omitted. */
  const statements = (name = '') =>
    Object.entries(template.findResources('AWS::IAM::Policy'))
      .filter(([id]) => id.startsWith(name))
      .flatMap(([, policy]) => policy.Properties.PolicyDocument.Statement as Statement[]);

  it('retries a failing job 3 times, then parks it in the dead-letter queue for 14 days', () => {
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'test-processing',
      RedrivePolicy: Match.objectLike({ maxReceiveCount: 3 }),
    });
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'test-processing-dlq',
      MessageRetentionPeriod: 14 * 24 * 60 * 60,
    });
  });

  it('hides a message for longer than the longest possible job', () => {
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'test-processing',
      VisibilityTimeout: 16 * 60,
    });
    template.hasResourceProperties('AWS::Lambda::Function', { Timeout: 15 * 60 });
  });

  it('gives the processor 10 GiB of temporary disk and the ffmpeg layer', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x',
      Architectures: ['arm64'],
      EphemeralStorage: { Size: 10240 },
    });
    const [processor] = Object.values(template.findResources('AWS::Lambda::Function'));
    expect(processor?.Properties.Layers).toHaveLength(1);
    template.hasResourceProperties('AWS::Lambda::LayerVersion', {
      CompatibleArchitectures: ['arm64'],
    });
  });

  it('processes one video per invocation, at most two at once', () => {
    template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      BatchSize: 1,
      ScalingConfig: { MaximumConcurrency: 2 },
      FunctionResponseTypes: ['ReportBatchItemFailures'],
    });
  });

  it('can read originals and write media, and nothing else in S3', () => {
    const s3 = statements('Processor').filter((statement) =>
      [statement.Action].flat().some((action) => action.startsWith('s3:')),
    );

    expect(s3.map((statement) => [statement.Action].flat().sort())).toEqual([
      ['s3:GetObject'],
      ['s3:AbortMultipartUpload', 's3:PutObject'],
    ]);
    expect(JSON.stringify(s3[0]!.Resource)).toContain('/uploads/*');
    expect(JSON.stringify(s3[1]!.Resource)).toContain('/media/*');
  });

  it('never grants wildcard actions, and the video processor cannot delete videos or records', () => {
    for (const action of statements().flatMap((statement) => statement.Action)) {
      expect(action).not.toContain('*');
    }
    for (const action of statements('Processor').flatMap((statement) => statement.Action)) {
      expect(action).not.toMatch(/^(s3|dynamodb):Delete/);
      expect(action).not.toMatch(/^cognito/);
    }
  });

  describe('account deletion', () => {
    const actions = () =>
      statements('AccountDeleter')
        .flatMap((statement) => statement.Action)
        .sort();

    it('has its own queue: 3 attempts, 11 minutes apart, then a dead-letter queue', () => {
      template.hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'test-account-deletion',
        VisibilityTimeout: 11 * 60,
        RedrivePolicy: Match.objectLike({ maxReceiveCount: 3 }),
      });
      template.hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'test-account-deletion-dlq',
        MessageRetentionPeriod: 14 * 24 * 60 * 60,
      });
    });

    it('may delete records, files and the sign-in account, and nothing more', () => {
      expect(actions().filter((action) => !action.startsWith('sqs:'))).toEqual([
        'cognito-idp:AdminDeleteUser',
        'cognito-idp:ListUsers',
        'dynamodb:BatchGetItem',
        'dynamodb:BatchWriteItem',
        'dynamodb:DeleteItem',
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:Query',
        'dynamodb:UpdateItem',
        's3:AbortMultipartUpload',
        's3:DeleteObject',
        's3:DeleteObject',
      ]);
    });

    it('can never read a video file', () => {
      expect(actions()).not.toContain('s3:GetObject');
    });

    it('limits its file access to the uploads/ and media/ prefixes', () => {
      for (const statement of statements('AccountDeleter')) {
        if ([statement.Action].flat().some((action) => action.startsWith('s3:'))) {
          expect(JSON.stringify(statement.Resource)).toMatch(/\/(uploads|media)\/\*/);
        }
      }
    });
  });

  it('refuses to build an empty layer when the ffmpeg binaries are missing', () => {
    const app = new App();
    const data = new DataStack(app, 'Data', { prefix: 'test' });
    const storage = new StorageStack(app, 'Storage', { webOrigins: [] });

    expect(
      () =>
        new ProcessingStack(app, 'Processing', {
          prefix: 'test',
          table: data.table,
          uploadsBucket: storage.uploadsBucket,
          mediaBucket: storage.mediaBucket,
          userPool: new AuthStack(app, 'TestAuth2', { prefix: 'test' }).userPool,
          ffmpegLayerDir: mkdtempSync(join(tmpdir(), 'no-ffmpeg-')),
        }),
    ).toThrow(/fetch:ffmpeg/);
  });
});
