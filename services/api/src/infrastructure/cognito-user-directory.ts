import {
  ListUsersCommand,
  type CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import type { UserDirectory } from '../application/ports';

// Cognito user ids. Checked before they go into a filter expression.
const USER_ID = /^[0-9a-f-]{36}$/;

export class CognitoUserDirectory implements UserDirectory {
  constructor(
    private readonly cognito: CognitoIdentityProviderClient,
    private readonly userPoolId: string,
  ) {}

  /** One lookup per user: an event has at most 50 collaborators. */
  async emailsOf(userIds: readonly string[]): Promise<Map<string, string>> {
    const emails = new Map<string, string>();
    await Promise.all(
      userIds
        .filter((userId) => USER_ID.test(userId))
        .map(async (userId) => {
          const { Users } = await this.cognito.send(
            new ListUsersCommand({
              UserPoolId: this.userPoolId,
              Filter: `sub = "${userId}"`,
              Limit: 1,
            }),
          );
          const email = Users?.[0]?.Attributes?.find(({ Name }) => Name === 'email')?.Value;
          if (email) emails.set(userId, email);
        }),
    );
    return emails;
  }
}
