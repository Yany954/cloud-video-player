import { CfnOutput, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { AttributeType, Billing, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import type { Construct } from 'constructs';

const stringKey = (name: string) => ({ name, type: AttributeType.STRING });

/**
 * Single-table design. Key patterns (built only in services/api infrastructure adapters):
 *
 *   Item      PK                    SK
 *   User      USER#{cognitoSub}     PROFILE
 *   Video     VIDEO#{videoId}       META        (later: CHAPTER#…, COMMENT#…, ANGLE#… in the same partition)
 *   Category  CATEGORY#{categoryId} META
 *
 *   Index  PK                         SK         Access pattern                  Items present
 *   GSI1   OWNER#{userId}             createdAt  "my videos", newest first       every video
 *          OWNER#{userId}#CATEGORIES  createdAt  "my events", newest first       every category
 *   GSI2   CATEGORY#{id}              createdAt  the videos of one event         videos put in a category (sparse)
 *          CATEGORIES                 createdAt  events shared with everyone     shared categories (sparse)
 *   GSI3   MODERATION#queue           createdAt  admin review queue, oldest 1st  playable, undecided videos (sparse)
 *          MODERATION#library         createdAt  the library, newest first       approved, non-private videos (sparse)
 */
export class DataStack extends Stack {
  readonly table: TableV2;

  constructor(scope: Construct, id: string, props: StackProps & { prefix: string }) {
    super(scope, id, props);

    this.table = new TableV2(this, 'Table', {
      tableName: `${props.prefix}-data`,
      partitionKey: stringKey('PK'),
      sortKey: stringKey('SK'),
      globalSecondaryIndexes: [
        { indexName: 'GSI1', partitionKey: stringKey('GSI1PK'), sortKey: stringKey('GSI1SK') },
        { indexName: 'GSI2', partitionKey: stringKey('GSI2PK'), sortKey: stringKey('GSI2SK') },
        { indexName: 'GSI3', partitionKey: stringKey('GSI3PK'), sortKey: stringKey('GSI3SK') },
      ],
      billing: Billing.onDemand(),
      // Restore to any second in the last 35 days (e.g. after a bug writes bad data).
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      // Free automatic cleanup, e.g. abandoned upload sessions.
      timeToLiveAttribute: 'expiresAt',
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    new CfnOutput(this, 'TableName', { value: this.table.tableName });
  }
}
