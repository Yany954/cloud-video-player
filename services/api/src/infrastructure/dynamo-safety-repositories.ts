import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DeleteCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { BlockRepository, ReportRepository } from '../application/ports';
import type { Block, Report } from '../domain/safety';
import {
  BLOCK_PREFIX,
  blockKey,
  fromBlockItem,
  fromReportItem,
  REPORT_PREFIX,
  reportKey,
  toBlockItem,
  toReportItem,
} from './safety-item';

// The most writes one batch accepts.
const BATCH_SIZE = 25;

/** Every item of one partition whose sort key starts with `prefix`. */
async function queryPrefix(
  doc: DynamoDBDocumentClient,
  tableName: string,
  partition: string,
  prefix: string,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let start: Record<string, unknown> | undefined;
  do {
    const page = await doc.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK = :partition AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':partition': partition, ':prefix': prefix },
        ExclusiveStartKey: start,
      }),
    );
    items.push(...(page.Items ?? []));
    start = page.LastEvaluatedKey;
  } while (start);
  return items;
}

async function deleteAll(
  doc: DynamoDBDocumentClient,
  tableName: string,
  items: Record<string, unknown>[],
): Promise<void> {
  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    await doc.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: items
            .slice(start, start + BATCH_SIZE)
            .map((item) => ({ DeleteRequest: { Key: { PK: item.PK, SK: item.SK } } })),
        },
      }),
    );
  }
}

const byCreation = (a: { createdAt: string }, b: { createdAt: string }) =>
  a.createdAt.localeCompare(b.createdAt);

export class DynamoReportRepository implements ReportRepository {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async add(report: Report): Promise<boolean> {
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.tableName,
          Item: toReportItem(report),
          // One report per person and video.
          ConditionExpression: 'attribute_not_exists(PK)',
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  }

  async listByVideo(videoId: string): Promise<Report[]> {
    const items = await queryPrefix(
      this.doc,
      this.tableName,
      reportKey(videoId, '').PK,
      REPORT_PREFIX,
    );
    return items.map(fromReportItem).sort(byCreation);
  }

  async deleteByVideo(videoId: string): Promise<void> {
    const items = await queryPrefix(
      this.doc,
      this.tableName,
      reportKey(videoId, '').PK,
      REPORT_PREFIX,
    );
    await deleteAll(this.doc, this.tableName, items);
  }
}

export class DynamoBlockRepository implements BlockRepository {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async add(block: Block): Promise<void> {
    await this.doc.send(new PutCommand({ TableName: this.tableName, Item: toBlockItem(block) }));
  }

  async remove(blockerId: string, blockedId: string): Promise<void> {
    await this.doc.send(
      new DeleteCommand({ TableName: this.tableName, Key: blockKey(blockerId, blockedId) }),
    );
  }

  async listByBlocker(blockerId: string): Promise<Block[]> {
    const items = await queryPrefix(
      this.doc,
      this.tableName,
      blockKey(blockerId, '').PK,
      BLOCK_PREFIX,
    );
    return items.map(fromBlockItem).sort(byCreation).reverse();
  }

  async deleteByBlocker(blockerId: string): Promise<void> {
    const items = await queryPrefix(
      this.doc,
      this.tableName,
      blockKey(blockerId, '').PK,
      BLOCK_PREFIX,
    );
    await deleteAll(this.doc, this.tableName, items);
  }
}
