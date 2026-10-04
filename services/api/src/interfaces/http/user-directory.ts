import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { CognitoUserDirectory } from '../../infrastructure/cognito-user-directory';
import { env } from '../env';

// Kept out of container.ts so only the routes that show email addresses bundle the Cognito SDK.
export const userDirectory = new CognitoUserDirectory(
  new CognitoIdentityProviderClient({}),
  env('USER_POOL_ID'),
);
