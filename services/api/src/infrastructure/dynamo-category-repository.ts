import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { CategoryRepository } from '../application/ports';
import type { Category } from '../domain/category';
import {
  categoryKey,
  fromCategoryItem,
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

  async delete(id: string): Promise<void> {
    await this.doc.send(new DeleteCommand({ TableName: this.tableName, Key: categoryKey(id) }));
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
