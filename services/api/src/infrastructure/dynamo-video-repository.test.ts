import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import type {
  BatchGetCommand,
  DynamoDBDocumentClient,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { describe, expect, it, vi } from 'vitest';
import { assignToCategory, createCategory } from '../domain/category';
import { reviewVideo } from '../domain/moderation';
import { completeUpload, markReady, startProcessing, startUpload } from '../domain/video';
import { toVideoItem } from './video-item';
import { DynamoVideoRepository } from './dynamo-video-repository';

const completed = completeUpload(
  {
    ...startUpload({
      id: 'video-1',
      ownerId: 'user-1',
      fileName: 'concert.mp4',
      sizeBytes: 300,
      now: new Date('2026-10-03T10:00:00.000Z'),
    }),
    uploadSessionId: 'session-1',
  },
  300,
);

function setup(send = vi.fn().mockResolvedValue({})) {
  const accounts = { getUsage: async () => ({ bytesUsed: 0, quotaBytes: 1_000 }) };
  const doc = { send } as unknown as DynamoDBDocumentClient;
  return { send, repository: new DynamoVideoRepository(doc, 'table', accounts) };
}

const cancelled = (...codes: string[]) =>
  new TransactionCanceledException({
    message: 'cancelled',
    $metadata: {},
    CancellationReasons: codes.map((Code) => ({ Code })),
  });

describe('DynamoVideoRepository.saveCompleted', () => {
  it('writes the video and the usage in one transaction, guarded by the quota', async () => {
    const { send, repository } = setup();

    await repository.saveCompleted(completed);

    const [video, account] = (send.mock.calls[0]![0] as TransactWriteCommand).input.TransactItems!;
    expect(video!.Put).toMatchObject({
      Item: { PK: 'VIDEO#video-1', uploadStatus: 'uploaded', sizeBytes: 300 },
      ConditionExpression: 'uploadStatus = :uploading',
    });
    expect(account!.Update).toMatchObject({
      Key: { PK: 'USER#user-1', SK: 'PROFILE' },
      // quota 1,000 - size 300: usage before this write must be at most 700.
      ExpressionAttributeValues: { ':size': 300, ':quota': 1_000, ':maxBefore': 700 },
    });
  });

  it('reports QUOTA_EXCEEDED when the usage condition fails', async () => {
    const { repository } = setup(
      vi.fn().mockRejectedValue(cancelled('None', 'ConditionalCheckFailed')),
    );

    await expect(repository.saveCompleted(completed)).rejects.toMatchObject({
      code: 'QUOTA_EXCEEDED',
    });
  });

  it('reports INVALID_STATE when the video was already completed', async () => {
    const { repository } = setup(
      vi.fn().mockRejectedValue(cancelled('ConditionalCheckFailed', 'None')),
    );

    await expect(repository.saveCompleted(completed)).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
  });

  it('rejects a file bigger than the whole quota without calling DynamoDB', async () => {
    const { send, repository } = setup();

    await expect(
      repository.saveCompleted({ ...completed, sizeBytes: 1_001 }),
    ).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('DynamoVideoRepository review queue', () => {
  const query = (send: ReturnType<typeof vi.fn>) => (send.mock.calls[0]![0] as QueryCommand).input;

  it('reads the review queue oldest first', async () => {
    const { send, repository } = setup();

    await repository.listAwaitingReview(100);

    expect(query(send)).toMatchObject({
      IndexName: 'GSI3',
      ExpressionAttributeValues: { ':queue': 'MODERATION#queue' },
      ScanIndexForward: true,
      Limit: 100,
    });
  });
});

describe('DynamoVideoRepository.deleteCounted', () => {
  it('removes the video and gives its bytes back in one transaction', async () => {
    const { send, repository } = setup();

    await repository.deleteCounted(completed);

    const [video, account] = (send.mock.calls[0]![0] as TransactWriteCommand).input.TransactItems!;
    expect(video!.Delete).toMatchObject({
      Key: { PK: 'VIDEO#video-1', SK: 'META' },
      ConditionExpression: 'uploadStatus = :status',
      ExpressionAttributeValues: { ':status': 'uploaded' },
    });
    expect(account!.Update).toMatchObject({
      Key: { PK: 'USER#user-1', SK: 'PROFILE' },
      UpdateExpression: 'ADD bytesUsed :negative',
      ConditionExpression: 'bytesUsed >= :size',
      ExpressionAttributeValues: { ':negative': -300, ':size': 300 },
    });
  });

  it('reports INVALID_STATE when the video changed or was already deleted', async () => {
    const { repository } = setup(
      vi.fn().mockRejectedValue(cancelled('ConditionalCheckFailed', 'None')),
    );

    await expect(repository.deleteCounted(completed)).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
  });
});

describe('DynamoVideoRepository.saveCategoryOf', () => {
  const event = createCategory({
    id: 'cat-1',
    ownerId: 'user-1',
    name: 'Concert',
    now: new Date(),
  });
  const update = (send: ReturnType<typeof vi.fn>) =>
    (send.mock.calls[0]![0] as UpdateCommand).input;

  it('writes only the category attributes, and drops index keys the video no longer has', async () => {
    const { send, repository } = setup();

    await repository.saveCategoryOf(assignToCategory(completed, event));

    expect(update(send)).toMatchObject({
      Key: { PK: 'VIDEO#video-1', SK: 'META' },
      UpdateExpression:
        'SET #categoryId = :categoryId, #private = :private, #GSI2PK = :GSI2PK, #GSI2SK = :GSI2SK',
      ExpressionAttributeValues: {
        ':categoryId': 'cat-1',
        ':private': true,
        ':GSI2PK': 'CATEGORY#cat-1',
        ':GSI2SK': '2026-10-03T10:00:00.000Z',
      },
      ConditionExpression: 'attribute_exists(PK)',
    });
  });

  it('removes the category keys when the video is taken out', async () => {
    const { send, repository } = setup();

    await repository.saveCategoryOf(assignToCategory(completed, null));

    expect(update(send).UpdateExpression).toBe(
      'SET #categoryId = :categoryId, #private = :private REMOVE #GSI2PK, #GSI2SK',
    );
    expect(update(send).ExpressionAttributeValues).toEqual({
      ':categoryId': null,
      ':private': false,
    });
  });
});

describe('DynamoVideoRepository.saveModeration', () => {
  it('writes only the moderation attributes, leaving the category as stored', async () => {
    const { send, repository } = setup();
    const ready = markReady(startProcessing(completed), {
      durationSeconds: 60,
      width: 1920,
      height: 1080,
    });

    await repository.saveModeration(
      reviewVideo(ready, 'approve', 'admin-1', new Date('2026-10-03T12:00:00.000Z')),
    );

    const update = (send.mock.calls[0]![0] as UpdateCommand).input;
    expect(update.UpdateExpression).toBe(
      'SET #moderationStatus = :moderationStatus, #review = :review REMOVE #GSI3PK, #GSI3SK',
    );
    expect(update.ExpressionAttributeValues).toEqual({
      ':moderationStatus': 'approved',
      ':review': { reviewedBy: 'admin-1', reviewedAt: '2026-10-03T12:00:00.000Z' },
    });
    expect(update.ConditionExpression).toBe('attribute_exists(PK)');
  });
});

describe('DynamoVideoRepository.listByCategory', () => {
  const event = createCategory({
    id: 'cat-1',
    ownerId: 'user-1',
    name: 'Concert',
    now: new Date(),
  });
  const inEvent = (id: string) => toVideoItem(assignToCategory({ ...completed, id }, event));
  const key = (id: string) => ({ PK: `VIDEO#${id}`, SK: 'META' });

  it('finds the videos in the index, then reads the rows themselves consistently', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Items: [key('a'), key('b')] })
      .mockResolvedValueOnce({ Responses: { table: [inEvent('b'), inEvent('a')] } });
    const { repository } = setup(send);

    const videos = await repository.listByCategory('cat-1', 200);

    expect(videos.map((video) => video.id)).toEqual(['a', 'b']);
    expect((send.mock.calls[0]![0] as QueryCommand).input).toMatchObject({
      IndexName: 'GSI2',
      ExpressionAttributeValues: { ':category': 'CATEGORY#cat-1' },
      Limit: 200,
    });
    expect((send.mock.calls[1]![0] as BatchGetCommand).input.RequestItems).toEqual({
      table: { Keys: [key('a'), key('b')], ConsistentRead: true },
    });
  });

  it('leaves out a video the index still lists but that was taken out or deleted', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Items: [key('gone'), key('moved'), key('stays')] })
      .mockResolvedValueOnce({
        Responses: {
          table: [
            toVideoItem(assignToCategory({ ...completed, id: 'moved' }, null)),
            inEvent('stays'),
          ],
        },
      });
    const { repository } = setup(send);

    expect((await repository.listByCategory('cat-1', 200)).map((video) => video.id)).toEqual([
      'stays',
    ]);
  });

  it('asks again for rows DynamoDB did not return, and reads nothing for an empty category', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Items: [key('a'), key('b')] })
      .mockResolvedValueOnce({
        Responses: { table: [inEvent('a')] },
        UnprocessedKeys: { table: { Keys: [key('b')] } },
      })
      .mockResolvedValueOnce({ Responses: { table: [inEvent('b')] } });
    const { repository } = setup(send);

    expect(await repository.listByCategory('cat-1', 200)).toHaveLength(2);
    expect(send).toHaveBeenCalledTimes(3);

    const empty = setup(vi.fn().mockResolvedValue({ Items: [] }));
    expect(await empty.repository.listByCategory('cat-1', 200)).toEqual([]);
    expect(empty.send).toHaveBeenCalledTimes(1);
  });
});
