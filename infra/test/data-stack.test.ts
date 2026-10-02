import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { DataStack } from '../lib/data-stack';

describe('DataStack', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(new DataStack(new App(), 'TestData', { prefix: 'test' }));
  });

  it('is a single table keyed by PK/SK strings', () => {
    template.resourceCountIs('AWS::DynamoDB::GlobalTable', 1);
    template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
      TableName: 'test-data',
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
    });
  });

  it.each(['GSI1', 'GSI2', 'GSI3'])('has the %s index on its own PK/SK', (index) => {
    template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: index,
          KeySchema: [
            { AttributeName: `${index}PK`, KeyType: 'HASH' },
            { AttributeName: `${index}SK`, KeyType: 'RANGE' },
          ],
        }),
      ]),
    });
  });

  it('uses on-demand billing', () => {
    template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
      BillingMode: 'PAY_PER_REQUEST',
    });
  });

  it('enables point-in-time recovery, deletion protection and TTL', () => {
    const tables = template.findResources('AWS::DynamoDB::GlobalTable');
    const table = Object.values(tables)[0];
    expect(table?.DeletionPolicy).toBe('Retain');
    expect(table?.Properties.TimeToLiveSpecification).toEqual({
      AttributeName: 'expiresAt',
      Enabled: true,
    });
    expect(table?.Properties.Replicas).toEqual([
      expect.objectContaining({
        DeletionProtectionEnabled: true,
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
      }),
    ]);
  });
});
