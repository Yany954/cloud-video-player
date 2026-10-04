import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { DeleteAccountData } from '../../application/user/account-deletion';
import { documentClient, s3Client } from '../../infrastructure/aws-clients';
import { CognitoUserAccounts } from '../../infrastructure/cognito-user-accounts';
import { DynamoCategoryRepository } from '../../infrastructure/dynamo-category-repository';
import { DynamoStorageAccountRepository } from '../../infrastructure/dynamo-storage-account-repository';
import { DynamoVideoRepository } from '../../infrastructure/dynamo-video-repository';
import { S3ObjectStorage } from '../../infrastructure/s3-object-storage';
import type { AccountDeletionMessage } from '../../infrastructure/sqs-processing-queue';
import { env } from '../env';

const accounts = new DynamoStorageAccountRepository(documentClient, env('TABLE_NAME'));
const deleteAccountData = new DeleteAccountData(
  new DynamoVideoRepository(documentClient, env('TABLE_NAME'), accounts),
  new DynamoCategoryRepository(documentClient, env('TABLE_NAME')),
  new S3ObjectStorage(s3Client, env('UPLOADS_BUCKET'), env('MEDIA_BUCKET')),
  accounts,
  new CognitoUserAccounts(new CognitoIdentityProviderClient({}), env('USER_POOL_ID')),
);

// Triggered by the account-deletion queue, one account per message.
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const failures: SQSBatchResponse['batchItemFailures'] = [];
  for (const record of event.Records) {
    const { userId } = JSON.parse(record.body) as AccountDeletionMessage;
    const attempt = Number(record.attributes.ApproximateReceiveCount);
    try {
      await deleteAccountData.execute({ userId });
      console.log(JSON.stringify({ userId, attempt, outcome: 'deleted' }));
    } catch (error) {
      console.error(JSON.stringify({ userId, attempt, outcome: 'error' }), error);
      // Back to the queue: the job only removes what is still there, so a retry is safe.
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures: failures };
}
