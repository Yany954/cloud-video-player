import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminInitiateAuthCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUserGlobalSignOutCommand,
  ListUsersCommand,
  ListUsersInGroupCommand,
  NotAuthorizedException,
  UsernameExistsException,
  type CognitoIdentityProviderClient,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider';
import type { UserAccounts } from '../application/ports';
import { DomainError } from '../domain/errors';
import type { UserAccount, UserRole, UserStatus } from '../domain/user';

const ADMIN_GROUP = 'admin';
// Cognito user ids. Checked before they go into a filter expression.
const USER_ID = /^[0-9a-f-]{36}$/;
// The most users Cognito returns per page.
const PAGE_SIZE = 60;

const attribute = (user: UserType, name: string) =>
  user.Attributes?.find((item) => item.Name === name)?.Value ?? '';

function statusOf(user: UserType): UserStatus {
  if (user.Enabled === false) return 'suspended';
  if (user.UserStatus === 'FORCE_CHANGE_PASSWORD') return 'invited';
  if (user.UserStatus === 'UNCONFIRMED') return 'unconfirmed';
  return 'active';
}

function toAccount(user: UserType, role: UserRole): UserAccount {
  return {
    id: attribute(user, 'sub'),
    email: attribute(user, 'email'),
    role,
    status: statusOf(user),
    createdAt: (user.UserCreateDate ?? new Date(0)).toISOString(),
  };
}

export class CognitoUserAccounts implements UserAccounts {
  constructor(
    private readonly cognito: CognitoIdentityProviderClient,
    private readonly userPoolId: string,
    /** Only needed to check a password. */
    private readonly appClientId?: string,
  ) {}

  async list(limit: number): Promise<UserAccount[]> {
    const admins = await this.adminUsernames();
    const users: UserType[] = [];
    let token: string | undefined;
    do {
      const page = await this.cognito.send(
        new ListUsersCommand({
          UserPoolId: this.userPoolId,
          Limit: Math.min(PAGE_SIZE, limit - users.length),
          PaginationToken: token,
        }),
      );
      users.push(...(page.Users ?? []));
      token = page.PaginationToken;
    } while (token && users.length < limit);

    return users
      .map((user) => toAccount(user, admins.has(user.Username ?? '') ? 'admin' : 'user'))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async findById(userId: string): Promise<UserAccount | null> {
    const user = await this.find(userId);
    if (!user) return null;
    const { Groups } = await this.cognito.send(
      new AdminListGroupsForUserCommand({ UserPoolId: this.userPoolId, Username: user.Username }),
    );
    const isAdmin = (Groups ?? []).some((group) => group.GroupName === ADMIN_GROUP);
    return toAccount(user, isAdmin ? 'admin' : 'user');
  }

  async invite(email: string): Promise<UserAccount> {
    try {
      const { User } = await this.cognito.send(
        new AdminCreateUserCommand({
          UserPoolId: this.userPoolId,
          Username: email,
          // The admin vouches for the address: the invitation itself is sent to it.
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'email_verified', Value: 'true' },
          ],
          DesiredDeliveryMediums: ['EMAIL'],
        }),
      );
      if (!User) throw new Error('Cognito did not return the new user');
      return toAccount(User, 'user');
    } catch (error) {
      if (error instanceof UsernameExistsException) {
        throw new DomainError('USER_EXISTS', 'An account with this email already exists');
      }
      throw error;
    }
  }

  async setRole(userId: string, role: UserRole): Promise<void> {
    const target = { UserPoolId: this.userPoolId, Username: await this.usernameOf(userId) };
    await this.cognito.send(
      role === 'admin'
        ? new AdminAddUserToGroupCommand({ ...target, GroupName: ADMIN_GROUP })
        : new AdminRemoveUserFromGroupCommand({ ...target, GroupName: ADMIN_GROUP }),
    );
  }

  async setSuspended(userId: string, suspended: boolean): Promise<void> {
    const target = { UserPoolId: this.userPoolId, Username: await this.usernameOf(userId) };
    if (!suspended) {
      await this.cognito.send(new AdminEnableUserCommand(target));
      return;
    }
    await this.cognito.send(new AdminDisableUserCommand(target));
    // Ends their sessions: no new tokens. A token already issued still works until it expires.
    await this.cognito.send(new AdminUserGlobalSignOutCommand(target));
  }

  async countAdmins(): Promise<number> {
    return (await this.adminUsernames()).size;
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const username = (await this.find(userId))?.Username;
    if (!username || !this.appClientId) return false;
    try {
      // Tokens, or a second-factor challenge: either way the password was right. The result is
      // never used for anything else.
      await this.cognito.send(
        new AdminInitiateAuthCommand({
          UserPoolId: this.userPoolId,
          ClientId: this.appClientId,
          AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
          AuthParameters: { USERNAME: username, PASSWORD: password },
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof NotAuthorizedException) return false;
      throw error;
    }
  }

  async delete(userId: string): Promise<void> {
    const username = (await this.find(userId))?.Username;
    // Already gone: a repeated job has nothing left to do.
    if (!username) return;
    await this.cognito.send(
      new AdminDeleteUserCommand({ UserPoolId: this.userPoolId, Username: username }),
    );
  }

  private async find(userId: string): Promise<UserType | null> {
    if (!USER_ID.test(userId)) return null;
    const { Users } = await this.cognito.send(
      new ListUsersCommand({ UserPoolId: this.userPoolId, Filter: `sub = "${userId}"`, Limit: 1 }),
    );
    return Users?.[0] ?? null;
  }

  private async usernameOf(userId: string): Promise<string> {
    const username = (await this.find(userId))?.Username;
    if (!username) throw new Error(`No such user: ${userId}`);
    return username;
  }

  private async adminUsernames(): Promise<Set<string>> {
    const usernames = new Set<string>();
    let token: string | undefined;
    do {
      const page = await this.cognito.send(
        new ListUsersInGroupCommand({
          UserPoolId: this.userPoolId,
          GroupName: ADMIN_GROUP,
          NextToken: token,
        }),
      );
      for (const user of page.Users ?? []) if (user.Username) usernames.add(user.Username);
      token = page.NextToken;
    } while (token);
    return usernames;
  }
}
