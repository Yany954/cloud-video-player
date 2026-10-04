import type { Messages } from '../i18n/messages/en';

/** Turns a Cognito/Amplify error into a message that is safe and useful to show, in `m`'s language. */
export function authErrorMessage(error: unknown, m: Messages['authErrors']): string {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : '';

  if (/attempts exceeded/i.test(message) || /LimitExceeded|TooManyRequests/.test(name)) {
    return m.tooManyAttempts;
  }
  // Asked for a new password before ever finishing sign-up or the first sign-in.
  if (/cannot be reset in the current state/i.test(message)) {
    return m.stillTemporaryPassword;
  }
  if (/no registered\/verified email/i.test(message)) {
    return m.emailNeverConfirmed;
  }
  // Same message whether the email exists or not, so the form never reveals who has an account.
  if (name === 'NotAuthorizedException' || name === 'UserNotFoundException') {
    return m.incorrectCredentials;
  }
  if (name === 'UsernameExistsException') {
    return m.accountExists;
  }
  if (name === 'CodeMismatchException') {
    return m.wrongCode;
  }
  if (name === 'ExpiredCodeException') {
    return m.expiredCode;
  }
  if (name === 'InvalidParameterException' && /email/i.test(message)) {
    return m.invalidEmail;
  }
  if (name === 'InvalidPasswordException') {
    return m.passwordTooShort;
  }
  if (name === 'NetworkError' || /network/i.test(message)) {
    return m.network;
  }
  return m.unknown;
}
