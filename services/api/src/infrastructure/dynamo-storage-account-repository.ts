import {
  BatchGetCommand,
  GetCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { StorageAccountAdmin } from '../application/ports';
import { DEFAULT_QUOTA_BYTES, type StorageUsage } from '../domain/quota';
import { userKey } from './video-item';

// The most keys one batch read accepts.
const BATCH_SIZE = 100;

function toUsage(item: Record<string, unknown> | undefined): StorageUsage {
  return {
    bytesUsed: (item?.bytesUsed as number | undefined) ?? 0,
    quotaBytes: (item?.quotaBytes as number | undefined) ?? DEFAULT_QUOTA_BYTES,
  };
}

export class DynamoStorageAccountRepository implements StorageAccountAdmin {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  /** The profile item is only created by the first completed upload, so it may not exist yet. */
  async getUsage(userId: string): Promise<StorageUsage> {
    const { Item } = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: userKey(userId), ConsistentRead: true }),
    );
    return toUsage(Item);
  }

  async getUsages(userIds: readonly string[]): Promise<Map<string, StorageUsage>> {
    // Users with no profile item yet keep the defaults.
    const usages = new Map(userIds.map((userId) => [userId, toUsage(undefined)]));
    for (let start = 0; start < userIds.length; start += BATCH_SIZE) {
      const batch = userIds.slice(start, start + BATCH_SIZE);
      const { Responses } = await this.doc.send(
        new BatchGetCommand({
          RequestItems: { [this.tableName]: { Keys: batch.map(userKey) } },
        }),
      );
      for (const item of Responses?.[this.tableName] ?? []) {
        usages.set(String(item.PK).slice('USER#'.length), toUsage(item));
      }
    }
    return usages;
  }

  async setQuota(userId: string, quotaBytes: number): Promise<void> {
    await this.doc.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: userKey(userId),
        // Creates the profile item for someone who never uploaded; never touches bytesUsed.
        UpdateExpression: 'SET quotaBytes = :quota, #type = :user',
        ExpressionAttributeNames: { '#type': 'type' },
        ExpressionAttributeValues: { ':quota': quotaBytes, ':user': 'User' },
      }),
    );
  }
}
