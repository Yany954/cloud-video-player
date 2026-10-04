import {
  UsernameExistsException,
  type CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { describe, expect, it, vi } from 'vitest';
import { CognitoUserAccounts } from './cognito-user-accounts';

const ANA = '11111111-1111-1111-1111-111111111111';
const BEN = '22222222-2222-2222-2222-222222222222';

const cognitoUser = (sub: string, email: string, extra: object = {}) => ({
  Username: sub,
  Enabled: true,
  UserStatus: 'CONFIRMED',
  UserCreateDate: new Date('2026-10-01T10:00:00.000Z'),
  Attributes: [
    { Name: 'sub', Value: sub },
    { Name: 'email', Value: email },
  ],
  ...extra,
});

/** Answers each Cognito command by its class name. */
function setup(answers: Record<string, (input: Record<string, unknown>) => unknown>) {
  const send = vi.fn(async (command: { constructor: { name: string }; input: object }) => {
    const answer = answers[command.constructor.name];
    if (!answer) throw new Error(`Unexpected ${command.constructor.name}`);
    return answer(command.input as Record<string, unknown>);
  });
  const cognito = { send } as unknown as CognitoIdentityProviderClient;
  const sent = () => send.mock.calls.map(([command]) => command.constructor.name);
  return { send, sent, accounts: new CognitoUserAccounts(cognito, 'pool-1') };
}

describe('CognitoUserAccounts', () => {
  it('lists accounts oldest first, with role and status', async () => {
    const { accounts } = setup({
      ListUsersInGroupCommand: () => ({ Users: [{ Username: ANA }] }),
      ListUsersCommand: () => ({
        Users: [
          cognitoUser(BEN, 'ben@example.com', {
            Enabled: false,
            UserCreateDate: new Date('2026-10-03T10:00:00.000Z'),
          }),
          cognitoUser(ANA, 'ana@example.com'),
        ],
      }),
    });

    expect(await accounts.list(200)).toEqual([
      {
        id: ANA,
        email: 'ana@example.com',
        role: 'admin',
        status: 'active',
        createdAt: '2026-10-01T10:00:00.000Z',
      },
      {
        id: BEN,
        email: 'ben@example.com',
        role: 'user',
        status: 'suspended',
        createdAt: '2026-10-03T10:00:00.000Z',
      },
    ]);
  });

  it.each([
    ['FORCE_CHANGE_PASSWORD', 'invited'],
    ['UNCONFIRMED', 'unconfirmed'],
    ['CONFIRMED', 'active'],
  ])('reads Cognito status %s as %s', async (UserStatus, status) => {
    const { accounts } = setup({
      ListUsersCommand: () => ({ Users: [cognitoUser(ANA, 'ana@example.com', { UserStatus })] }),
      AdminListGroupsForUserCommand: () => ({ Groups: [] }),
    });

    expect((await accounts.findById(ANA))?.status).toBe(status);
  });

  it('never puts something that is not a user id into a filter', async () => {
    const { send, accounts } = setup({});

    expect(await accounts.findById('x" or email ^= "')).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it('invites by email, marking the address as verified', async () => {
    const { send, accounts } = setup({
      AdminCreateUserCommand: () => ({
        User: cognitoUser(BEN, 'ben@example.com', { UserStatus: 'FORCE_CHANGE_PASSWORD' }),
      }),
    });

    const user = await accounts.invite('ben@example.com');

    expect(user).toMatchObject({ id: BEN, status: 'invited', role: 'user' });
    expect(send.mock.calls[0]![0].input).toMatchObject({
      UserPoolId: 'pool-1',
      Username: 'ben@example.com',
      DesiredDeliveryMediums: ['EMAIL'],
    });
  });

  it('reports USER_EXISTS for an email that already has an account', async () => {
    const { accounts } = setup({
      AdminCreateUserCommand: () => {
        throw new UsernameExistsException({ message: 'exists', $metadata: {} });
      },
    });

    await expect(accounts.invite('ana@example.com')).rejects.toMatchObject({
      code: 'USER_EXISTS',
    });
  });

  it('suspends by disabling the account and ending its sessions', async () => {
    const { sent, accounts } = setup({
      ListUsersCommand: () => ({ Users: [cognitoUser(BEN, 'ben@example.com')] }),
      AdminDisableUserCommand: () => ({}),
      AdminUserGlobalSignOutCommand: () => ({}),
    });

    await accounts.setSuspended(BEN, true);

    expect(sent()).toEqual([
      'ListUsersCommand',
      'AdminDisableUserCommand',
      'AdminUserGlobalSignOutCommand',
    ]);
  });

  it('adds and removes the admin group', async () => {
    const { send, sent, accounts } = setup({
      ListUsersCommand: () => ({ Users: [cognitoUser(BEN, 'ben@example.com')] }),
      AdminAddUserToGroupCommand: () => ({}),
      AdminRemoveUserFromGroupCommand: () => ({}),
    });

    await accounts.setRole(BEN, 'admin');
    await accounts.setRole(BEN, 'user');

    expect(sent().filter((name) => name.startsWith('Admin'))).toEqual([
      'AdminAddUserToGroupCommand',
      'AdminRemoveUserFromGroupCommand',
    ]);
    expect(send.mock.calls[1]![0].input).toEqual({
      UserPoolId: 'pool-1',
      Username: BEN,
      GroupName: 'admin',
    });
  });
});
