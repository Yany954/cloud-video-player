import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { RequestAccountDeletion } from '../../application/user/account-deletion';
import { sqsClient } from '../../infrastructure/aws-clients';
import { CognitoUserAccounts } from '../../infrastructure/cognito-user-accounts';
import { SqsAccountDeletionQueue } from '../../infrastructure/sqs-processing-queue';
import { env } from '../env';

// Kept out of container.ts so only the two deletion routes bundle the Cognito SDK.
export const requestAccountDeletion = new RequestAccountDeletion(
  new CognitoUserAccounts(
    new CognitoIdentityProviderClient({}),
    env('USER_POOL_ID'),
    env('APP_CLIENT_ID'),
  ),
  new SqsAccountDeletionQueue(sqsClient, env('DELETION_QUEUE_URL')),
);
