import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { CategoryRepository } from '../application/ports';
import type { Category } from '../domain/category';
import { DomainError } from '../domain/errors';
import {
  categoryKey,
  fromCategoryItem,
  MEMBERSHIP_PREFIX,
  membershipKey,
  ownedCategoriesIndex,
  sharedCategoriesIndex,
  toCategoryItem,
} from './category-item';

export class DynamoCategoryRepository implements CategoryRepository {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async create(category: Category): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: toCategoryItem(category),
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );
  }

  async findById(id: string): Promise<Category | null> {
    const { Item } = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: categoryKey(id), ConsistentRead: true }),
    );
    return Item ? fromCategoryItem(Item) : null;
  }

  listByOwner(ownerId: string, limit: number): Promise<Category[]> {
    return this.list(
      ownedCategoriesIndex.name,
      'GSI1PK',
      ownedCategoriesIndex.partitionKey(ownerId),
      limit,
    );
  }

  listShared(limit: number): Promise<Category[]> {
    return this.list(
      sharedCategoriesIndex.name,
      'GSI2PK',
      sharedCategoriesIndex.partitionKey,
      limit,
    );
  }

  async save(category: Category): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: toCategoryItem(category),
        // Never resurrect a category that was deleted meanwhile.
        ConditionExpression: 'attribute_exists(PK)',
      }),
    );
  }

  async listByMember(userId: string, limit: number): Promise<Category[]> {
    const { Items: memberships } = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :user AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':user': membershipKey(userId, '').PK,
          ':prefix': MEMBERSHIP_PREFIX,
        },
        Limit: limit,
      }),
    );
    const keys = (memberships ?? []).map((item) => categoryKey(String(item.categoryId)));
    if (keys.length === 0) return [];

    // `limit` is at most 100, which is also the most keys one batch read accepts.
    const { Responses } = await this.doc.send(
      new BatchGetCommand({ RequestItems: { [this.tableName]: { Keys: keys } } }),
    );
    return (
      (Responses?.[this.tableName] ?? [])
        .map(fromCategoryItem)
        // The category is the source of truth: ignore a membership row it does not confirm.
        .filter((category) => category.collaboratorIds.includes(userId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  }

  async join(category: Category, userId: string): Promise<void> {
    try {
      await this.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.tableName,
                Key: categoryKey(category.id),
                // Appends, so two people joining at once are both kept.
                UpdateExpression: 'SET collaboratorIds = list_append(collaboratorIds, :user)',
                // The link the person opened must still be the current one.
                ConditionExpression: 'inviteToken = :token AND NOT contains(collaboratorIds, :id)',
                ExpressionAttributeValues: {
                  ':user': [userId],
                  ':id': userId,
                  ':token': category.inviteToken,
                },
              },
            },
            {
              Put: {
                TableName: this.tableName,
                Item: {
                  ...membershipKey(userId, category.id),
                  type: 'Membership',
                  categoryId: category.id,
                },
              },
            },
          ],
        }),
      );
    } catch (error) {
      if (error instanceof TransactionCanceledException) {
        throw new DomainError('INVALID_STATE', 'The invite link changed, open it again');
      }
      throw error;
    }
  }

  async leave(category: Category, userId: string): Promise<void> {
    await this.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.tableName,
              Item: toCategoryItem(category),
              ConditionExpression: 'attribute_exists(PK)',
            },
          },
          { Delete: { TableName: this.tableName, Key: membershipKey(userId, category.id) } },
        ],
      }),
    );
  }

  async delete(category: Category): Promise<void> {
    // At most 50 collaborators, well inside the 100 writes one transaction accepts.
    await this.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          { Delete: { TableName: this.tableName, Key: categoryKey(category.id) } },
          ...category.collaboratorIds.map((userId) => ({
            Delete: { TableName: this.tableName, Key: membershipKey(userId, category.id) },
          })),
        ],
      }),
    );
  }

  private async list(
    indexName: string,
    keyName: string,
    partition: string,
    limit: number,
  ): Promise<Category[]> {
    const { Items } = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: indexName,
        KeyConditionExpression: `${keyName} = :partition`,
        ExpressionAttributeValues: { ':partition': partition },
        // Both indexes are sorted by creation time; read them backwards for newest first.
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (Items ?? []).map(fromCategoryItem);
  }
}
