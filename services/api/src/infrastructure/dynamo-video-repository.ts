import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { StorageAccountRepository, VideoRepository } from '../application/ports';
import { DomainError } from '../domain/errors';
import type { Video } from '../domain/video';
import {
  CATEGORY_ATTRIBUTES,
  MODERATION_ATTRIBUTES,
  TITLE_ATTRIBUTES,
  categoryIndex,
  fromVideoItem,
  moderationIndex,
  ownerIndex,
  toVideoItem,
  userKey,
  videoKey,
} from './video-item';

type VideoKey = ReturnType<typeof videoKey>;
const BATCH_GET_LIMIT = 100;

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

  async listByOwner(ownerId: string, limit: number): Promise<Video[]> {
    const { Items } = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: ownerIndex.name,
        KeyConditionExpression: 'GSI1PK = :owner',
        ExpressionAttributeValues: { ':owner': ownerIndex.partitionKey(ownerId) },
        // The index is sorted by creation time; read it backwards for newest first.
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (Items ?? []).map(fromVideoItem);
  }

  async listByCategory(categoryId: string, limit: number): Promise<Video[]> {
    const { Items } = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: categoryIndex.name,
        KeyConditionExpression: 'GSI2PK = :category',
        ExpressionAttributeValues: { ':category': categoryIndex.partitionKey(categoryId) },
        ProjectionExpression: 'PK, SK',
        Limit: limit,
      }),
    );
    // The index lags behind the table for a moment, so it only says where to look. The rows
    // themselves are read consistently: a video just taken out of the category is not listed.
    const keys = (Items ?? []).map(({ PK, SK }) => ({ PK, SK }) as VideoKey);
    const rows = await this.getConsistently(keys);
    return keys
      .map((key) => rows.get(key.PK))
      .filter((video): video is Video => video !== undefined && video.categoryId === categoryId);
  }

  private async getConsistently(keys: VideoKey[]): Promise<Map<string, Video>> {
    const found = new Map<string, Video>();
    for (let start = 0; start < keys.length; start += BATCH_GET_LIMIT) {
      let pending: VideoKey[] | undefined = keys.slice(start, start + BATCH_GET_LIMIT);
      // DynamoDB may answer only part of a batch; ask again for the rest.
      while (pending?.length) {
        const { Responses, UnprocessedKeys } = await this.doc.send(
          new BatchGetCommand({
            RequestItems: { [this.tableName]: { Keys: pending, ConsistentRead: true } },
          }),
        );
        for (const item of Responses?.[this.tableName] ?? []) {
          found.set((item as VideoKey).PK, fromVideoItem(item));
        }
        pending = UnprocessedKeys?.[this.tableName]?.Keys as VideoKey[] | undefined;
      }
    }
    return found;
  }

  saveCategoryOf(video: Video): Promise<void> {
    return this.updateAttributes(video, CATEGORY_ATTRIBUTES);
  }

  saveModeration(video: Video): Promise<void> {
    return this.updateAttributes(video, MODERATION_ATTRIBUTES);
  }

  saveTitle(video: Video): Promise<void> {
    return this.updateAttributes(video, TITLE_ATTRIBUTES);
  }

  /** Writes only `attributes`, taken from `video`; the rest of the row is left as stored. */
  private async updateAttributes(video: Video, attributes: readonly string[]): Promise<void> {
    const item: Record<string, unknown> = { ...toVideoItem(video) };
    const set: string[] = [];
    const remove: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    // Index keys the video no longer has must be removed, or it would stay listed there.
    for (const attribute of attributes) {
      names[`#${attribute}`] = attribute;
      if (item[attribute] === undefined) {
        remove.push(`#${attribute}`);
      } else {
        set.push(`#${attribute} = :${attribute}`);
        values[`:${attribute}`] = item[attribute];
      }
    }
    await this.doc.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: videoKey(video.id),
        UpdateExpression:
          `SET ${set.join(', ')}` + (remove.length ? ` REMOVE ${remove.join(', ')}` : ''),
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ConditionExpression: 'attribute_exists(PK)',
      }),
    );
  }

  async listAwaitingReview(limit: number): Promise<Video[]> {
    const { Items } = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: moderationIndex.name,
        KeyConditionExpression: 'GSI3PK = :queue',
        ExpressionAttributeValues: { ':queue': moderationIndex.queue },
        // Oldest first, so nobody's upload waits behind newer ones.
        ScanIndexForward: true,
        Limit: limit,
      }),
    );
    return (Items ?? []).map(fromVideoItem);
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

  async save(video: Video): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: toVideoItem(video),
        // Never resurrect a video that was deleted while a job was working on it.
        ConditionExpression: 'attribute_exists(PK)',
      }),
    );
  }

  async delete(id: string): Promise<void> {
    await this.doc.send(new DeleteCommand({ TableName: this.tableName, Key: videoKey(id) }));
  }

  async deleteCounted(video: Video): Promise<void> {
    try {
      // Both writes succeed or neither does.
      await this.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: this.tableName,
                Key: videoKey(video.id),
                // Unchanged since it was read: a repeated request can't give bytes back twice.
                ConditionExpression: 'uploadStatus = :status',
                ExpressionAttributeValues: { ':status': video.uploadStatus },
              },
            },
            {
              Update: {
                TableName: this.tableName,
                Key: userKey(video.ownerId),
                UpdateExpression: 'ADD bytesUsed :negative',
                // Usage can never go below zero.
                ConditionExpression: 'bytesUsed >= :size',
                ExpressionAttributeValues: {
                  ':negative': -(video.sizeBytes ?? 0),
                  ':size': video.sizeBytes ?? 0,
                },
              },
            },
          ],
        }),
      );
    } catch (error) {
      if (
        error instanceof TransactionCanceledException &&
        error.CancellationReasons?.[0]?.Code === 'ConditionalCheckFailed'
      ) {
        throw new DomainError('INVALID_STATE', 'Video changed or was already deleted');
      }
      throw error;
    }
  }
}

function quotaExceeded() {
  return new DomainError('QUOTA_EXCEEDED', 'Not enough free storage for this file');
}
