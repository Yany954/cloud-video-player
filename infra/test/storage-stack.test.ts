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

  describe('media delivery', () => {
    it('serves only requests signed with our key, over HTTPS', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          DefaultCacheBehavior: Match.objectLike({
            ViewerProtocolPolicy: 'https-only',
            AllowedMethods: ['GET', 'HEAD'],
            TrustedKeyGroups: [Match.anyValue()],
          }),
          PriceClass: 'PriceClass_100',
        }),
      });
      template.resourceCountIs('AWS::CloudFront::PublicKey', 1);
    });

    it('lets CloudFront, and only this distribution, read the private media bucket', () => {
      template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
      const policy = JSON.stringify(template.findResources('AWS::S3::BucketPolicy'));
      expect(policy).toContain('cloudfront.amazonaws.com');
      expect(policy).toContain('AWS:SourceArn');
      // Still no public access on the bucket itself.
      expect(bucket(mediaId).Properties.PublicAccessBlockConfiguration.RestrictPublicBuckets).toBe(
        true,
      );
    });

    it('does not put the uploads bucket behind CloudFront', () => {
      const distributions = template.findResources('AWS::CloudFront::Distribution');
      expect(Object.keys(distributions)).toHaveLength(1);
      expect(JSON.stringify(distributions)).not.toContain(uploadsId);
    });
  });
});
