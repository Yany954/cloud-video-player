import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { describe, expect, it, vi } from 'vitest';
import type { Block, Report } from '../domain/safety';
import { DynamoBlockRepository, DynamoReportRepository } from './dynamo-safety-repositories';

const report: Report = {
  videoId: 'v1',
  reporterId: 'ben',
  reason: 'violence',
  note: null,
  createdAt: '2026-10-04T12:00:00.000Z',
};
const block: Block = {
  blockerId: 'ben',
  blockedId: 'ana',
  videoTitle: 'Concert',
  createdAt: '2026-10-04T12:00:00.000Z',
};

function setup(send = vi.fn().mockResolvedValue({})) {
  const doc = { send } as unknown as DynamoDBDocumentClient;
  return {
    send,
    reports: new DynamoReportRepository(doc, 'table'),
    blocks: new DynamoBlockRepository(doc, 'table'),
  };
}

describe('DynamoReportRepository', () => {
  it('stores one report per person in the video’s partition', async () => {
    const { send, reports } = setup();

    expect(await reports.add(report)).toBe(true);
    expect(send.mock.calls[0]![0].input).toMatchObject({
      Item: { PK: 'VIDEO#v1', SK: 'REPORT#ben', type: 'Report', reason: 'violence' },
      ConditionExpression: 'attribute_not_exists(PK)',
    });
  });

  it('says so when this person already reported the video', async () => {
    const { reports } = setup(
      vi
        .fn()
        .mockRejectedValue(new ConditionalCheckFailedException({ message: 'x', $metadata: {} })),
    );

    expect(await reports.add(report)).toBe(false);
  });

  it('reads only the reports of the partition, never the video itself', async () => {
    const { send, reports } = setup(vi.fn().mockResolvedValue({ Items: [] }));

    await reports.listByVideo('v1');

    expect(send.mock.calls[0]![0].input).toMatchObject({
      KeyConditionExpression: 'PK = :partition AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':partition': 'VIDEO#v1', ':prefix': 'REPORT#' },
    });
  });

  it('deletes every report of a video, by key', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Items: [{ PK: 'VIDEO#v1', SK: 'REPORT#ben' }] })
      .mockResolvedValue({});
    const { reports } = setup(send);

    await reports.deleteByVideo('v1');

    expect(send.mock.calls[1]![0].input.RequestItems.table).toEqual([
      { DeleteRequest: { Key: { PK: 'VIDEO#v1', SK: 'REPORT#ben' } } },
    ]);
  });
});

describe('DynamoBlockRepository', () => {
  it('keeps blocks in the blocker’s partition', async () => {
    const { send, blocks } = setup();

    await blocks.add(block);
    await blocks.remove('ben', 'ana');

    expect(send.mock.calls[0]![0].input.Item).toMatchObject({
      PK: 'USER#ben',
      SK: 'BLOCK#ana',
      type: 'Block',
      videoTitle: 'Concert',
    });
    expect(send.mock.calls[1]![0].input.Key).toEqual({ PK: 'USER#ben', SK: 'BLOCK#ana' });
  });

  it('lists newest first', async () => {
    const older = { ...block, blockedId: 'carla', createdAt: '2026-10-01T12:00:00.000Z' };
    const { blocks } = setup(vi.fn().mockResolvedValue({ Items: [older, block] }));

    expect((await blocks.listByBlocker('ben')).map((item) => item.blockedId)).toEqual([
      'ana',
      'carla',
    ]);
  });
});
