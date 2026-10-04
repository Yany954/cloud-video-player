import type { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { describe, expect, it, vi } from 'vitest';
import { CognitoUserDirectory } from './cognito-user-directory';

const ANA = '11111111-1111-1111-1111-111111111111';
const GONE = '22222222-2222-2222-2222-222222222222';

function setup() {
  const send = vi.fn(async (command: { input: { Filter: string } }) =>
    command.input.Filter.includes(ANA)
      ? { Users: [{ Attributes: [{ Name: 'email', Value: 'ana@example.com' }] }] }
      : { Users: [] },
  );
  const cognito = { send } as unknown as CognitoIdentityProviderClient;
  return { send, directory: new CognitoUserDirectory(cognito, 'pool-1') };
}

describe('CognitoUserDirectory', () => {
  it('returns the email of each user that still exists', async () => {
    const { directory } = setup();

    expect(await directory.emailsOf([ANA, GONE])).toEqual(new Map([[ANA, 'ana@example.com']]));
  });

  it('looks each user up by id, in our pool', async () => {
    const { send, directory } = setup();

    await directory.emailsOf([ANA]);

    expect(send.mock.calls[0]![0].input).toEqual({
      UserPoolId: 'pool-1',
      Filter: `sub = "${ANA}"`,
      Limit: 1,
    });
  });

  it('never puts something that is not a user id into the filter', async () => {
    const { send, directory } = setup();

    await directory.emailsOf(['x" or email ^= "']);

    expect(send).not.toHaveBeenCalled();
  });
});
