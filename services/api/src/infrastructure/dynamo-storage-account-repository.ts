import { GetCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { StorageAccountRepository } from '../application/ports';
import { DEFAULT_QUOTA_BYTES, type StorageUsage } from '../domain/quota';
import { userKey } from './video-item';

export class DynamoStorageAccountRepository implements StorageAccountRepository {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  /** The profile item is only created by the first completed upload, so it may not exist yet. */
  async getUsage(userId: string): Promise<StorageUsage> {
    const { Item } = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: userKey(userId), ConsistentRead: true }),
    );
    return {
      bytesUsed: (Item?.bytesUsed as number | undefined) ?? 0,
      quotaBytes: (Item?.quotaBytes as number | undefined) ?? DEFAULT_QUOTA_BYTES,
    };
  }
}
