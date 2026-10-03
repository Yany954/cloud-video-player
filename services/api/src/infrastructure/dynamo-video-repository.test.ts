import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import type { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { describe, expect, it, vi } from 'vitest';
import { completeUpload, startUpload } from '../domain/video';
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
