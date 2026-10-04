import { SendMessageCommand, type SQSClient } from '@aws-sdk/client-sqs';
import type { AccountDeletionQueue, ProcessingQueue } from '../application/ports';

export interface ProcessingMessage {
  videoId: string;
}

export class SqsProcessingQueue implements ProcessingQueue {
  constructor(
    private readonly sqs: SQSClient,
    private readonly queueUrl: string,
  ) {}

  async enqueue(videoId: string): Promise<void> {
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify({ videoId } satisfies ProcessingMessage),
      }),
    );
  }
}

export interface AccountDeletionMessage {
  userId: string;
}

export class SqsAccountDeletionQueue implements AccountDeletionQueue {
  constructor(
    private readonly sqs: SQSClient,
    private readonly queueUrl: string,
  ) {}

  async enqueue(userId: string): Promise<void> {
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify({ userId } satisfies AccountDeletionMessage),
      }),
    );
  }
}
