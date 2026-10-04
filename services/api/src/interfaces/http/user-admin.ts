import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { UserResponse } from '@cvp/shared';
import {
  InviteUser,
  ListUsers,
  UpdateUser,
  type UserWithUsage,
} from '../../application/user/users';
import { documentClient } from '../../infrastructure/aws-clients';
import { CognitoUserAccounts } from '../../infrastructure/cognito-user-accounts';
import { DynamoStorageAccountRepository } from '../../infrastructure/dynamo-storage-account-repository';
import { env } from '../env';

// Kept out of container.ts so only the admin user routes bundle the Cognito SDK.
const users = new CognitoUserAccounts(new CognitoIdentityProviderClient({}), env('USER_POOL_ID'));
const accounts = new DynamoStorageAccountRepository(documentClient, env('TABLE_NAME'));

export const listUsers = new ListUsers(users, accounts);
export const inviteUser = new InviteUser(users, accounts);
export const updateUser = new UpdateUser(users, accounts);

export function toUserResponse(user: UserWithUsage, callerId: string): UserResponse {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    bytesUsed: user.usage.bytesUsed,
    quotaBytes: user.usage.quotaBytes,
    isSelf: user.id === callerId,
  };
}
