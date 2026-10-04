import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './errors';

const named = (name: string, message = '') => Object.assign(new Error(message), { name });

describe('authErrorMessage', () => {
  it.each(['NotAuthorizedException', 'UserNotFoundException'])(
    'gives the same message for %s, so it never reveals who has an account',
    (name) => {
      expect(authErrorMessage(named(name))).toBe('Incorrect email or password.');
    },
  );

  it('recognises a locked-out account even though Cognito calls it NotAuthorized', () => {
    expect(authErrorMessage(named('NotAuthorizedException', 'Password attempts exceeded'))).toMatch(
      /Too many attempts/,
    );
  });

  it.each(['LimitExceededException', 'TooManyRequestsException'])('throttling: %s', (name) => {
    expect(authErrorMessage(named(name))).toMatch(/Too many attempts/);
  });

  it('explains the password rule', () => {
    expect(authErrorMessage(named('InvalidPasswordException'))).toMatch(/at least 12 characters/);
  });

  it.each([
    ['UsernameExistsException', /already exists\. Sign in instead/],
    ['CodeMismatchException', /code is not right/],
    ['ExpiredCodeException', /expired\. Ask for a new one/],
  ])('explains a sign-up problem: %s', (name, expected) => {
    expect(authErrorMessage(named(name))).toMatch(expected);
  });

  it('explains a connection problem', () => {
    expect(authErrorMessage(named('NetworkError'))).toMatch(/Check your connection/);
  });

  it('never leaks unknown error details', () => {
    expect(authErrorMessage(named('InternalErrorException', 'pool us-east-1_x failed'))).toBe(
      'Something went wrong. Please try again.',
    );
    expect(authErrorMessage('boom')).toBe('Something went wrong. Please try again.');
  });
});
