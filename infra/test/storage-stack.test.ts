import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { StorageStack } from '../lib/storage-stack';

describe('StorageStack', () => {
  let template: Template;
  let uploadsId: string;
  let mediaId: string;

  beforeAll(() => {
    const stack = new StorageStack(new App(), 'TestStorage', {
      webOrigins: ['http://localhost:3000'],
    });
    template = Template.fromStack(stack);
    uploadsId = stack.getLogicalId(stack.uploadsBucket.node.defaultChild as never);
    mediaId = stack.getLogicalId(stack.mediaBucket.node.defaultChild as never);
  });

  const bucket = (id: string) => template.toJSON().Resources[id];

  it('creates exactly two buckets', () => {
    template.resourceCountIs('AWS::S3::Bucket', 2);
  });

  it.each([
    ['uploads', () => uploadsId],
    ['media', () => mediaId],
  ])('%s bucket is private, encrypted, unversioned and retained', (_, id) => {
    const resource = bucket(id());
    expect(resource.DeletionPolicy).toBe('Retain');
    expect(resource.Properties.PublicAccessBlockConfiguration).toEqual({
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    });
    expect(resource.Properties.BucketEncryption).toBeDefined();
    expect(resource.Properties.VersioningConfiguration).toBeUndefined();
  });

  it('denies non-HTTPS access on both buckets', () => {
    const policies = template.findResources('AWS::S3::BucketPolicy', {
      Properties: {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: 'Deny',
              Condition: { Bool: { 'aws:SecureTransport': 'false' } },
            }),
          ]),
        },
      },
    });
    expect(Object.keys(policies)).toHaveLength(2);
  });

  it('lets the browser PUT parts and read their ETag', () => {
    expect(bucket(uploadsId).Properties.CorsConfiguration.CorsRules).toEqual([
      expect.objectContaining({
        AllowedMethods: ['PUT'],
        AllowedOrigins: ['http://localhost:3000'],
        ExposedHeaders: ['ETag'],
      }),
    ]);
    expect(bucket(mediaId).Properties.CorsConfiguration).toBeUndefined();
  });

  it('aborts unfinished multipart uploads after 7 days on both buckets', () => {
    for (const id of [uploadsId, mediaId]) {
      expect(bucket(id).Properties.LifecycleConfiguration.Rules).toContainEqual(
        expect.objectContaining({ AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 } }),
      );
    }
  });

  it('moves originals to Deep Archive after 30 days', () => {
    expect(bucket(uploadsId).Properties.LifecycleConfiguration.Rules).toContainEqual(
      expect.objectContaining({
        Transitions: [{ StorageClass: 'DEEP_ARCHIVE', TransitionInDays: 30 }],
      }),
    );
  });

  it('stores served media in Intelligent-Tiering from day 0', () => {
    expect(bucket(mediaId).Properties.LifecycleConfiguration.Rules).toContainEqual(
      expect.objectContaining({
        Transitions: [{ StorageClass: 'INTELLIGENT_TIERING', TransitionInDays: 0 }],
      }),
    );
  });
});
