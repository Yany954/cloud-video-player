import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { StorageAccountRepository, VideoRepository } from '../application/ports';
import { DomainError } from '../domain/errors';
import type { Video } from '../domain/video';
import { fromVideoItem, toVideoItem, userKey, videoKey } from './video-item';

export class DynamoVideoRepository implements VideoRepository {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly accounts: StorageAccountRepository,
  ) {}

  async create(video: Video): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: toVideoItem(video),
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );
  }

  async findById(id: string): Promise<Video | null> {
    const { Item } = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: videoKey(id), ConsistentRead: true }),
    );
    return Item ? fromVideoItem(Item) : null;
  }

  async saveCompleted(video: Video): Promise<void> {
    const sizeBytes = video.sizeBytes ?? 0;
    const { quotaBytes } = await this.accounts.getUsage(video.ownerId);
    // DynamoDB conditions can't do arithmetic, so "bytesUsed + size <= quota" is rewritten
    // as "bytesUsed <= quota - size", with the right-hand side computed here.
    const maxBytesUsedBefore = quotaBytes - sizeBytes;
    if (maxBytesUsedBefore < 0) throw quotaExceeded();

    try {
      // Both writes succeed or neither does.
      await this.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: toVideoItem(video),
                // Still uploading: a repeated request can't count the same bytes twice.
                ConditionExpression: 'uploadStatus = :uploading',
                ExpressionAttributeValues: { ':uploading': 'uploading' },
              },
            },
            {
              Update: {
                TableName: this.tableName,
                Key: userKey(video.ownerId),
                UpdateExpression:
                  'ADD bytesUsed :size SET quotaBytes = if_not_exists(quotaBytes, :quota), #type = :user',
                ConditionExpression:
                  '(attribute_not_exists(bytesUsed) OR bytesUsed <= :maxBefore) AND (attribute_not_exists(quotaBytes) OR quotaBytes = :quota)',
                ExpressionAttributeNames: { '#type': 'type' },
                ExpressionAttributeValues: {
                  ':size': sizeBytes,
                  ':quota': quotaBytes,
                  ':maxBefore': maxBytesUsedBefore,
                  ':user': 'User',
                },
              },
            },
          ],
        }),
      );
    } catch (error) {
      if (error instanceof TransactionCanceledException) {
        const [videoReason, accountReason] = error.CancellationReasons ?? [];
        if (videoReason?.Code === 'ConditionalCheckFailed') {
          throw new DomainError('INVALID_STATE', 'Video is no longer uploading');
        }
        if (accountReason?.Code === 'ConditionalCheckFailed') throw quotaExceeded();
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.doc.send(new DeleteCommand({ TableName: this.tableName, Key: videoKey(id) }));
  }
}

function quotaExceeded() {
  return new DomainError('QUOTA_EXCEEDED', 'Not enough free storage for this file');
}
