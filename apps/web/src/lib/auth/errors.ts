/** Turns a Cognito/Amplify error into a message that is safe and useful to show. */
export function authErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : '';

  if (/attempts exceeded/i.test(message) || /LimitExceeded|TooManyRequests/.test(name)) {
    return 'Too many attempts. Wait a few minutes and try again.';
  }
  // Asked for a new password before ever finishing sign-up or the first sign-in.
  if (/cannot be reset in the current state/i.test(message)) {
    return 'This account still has its temporary password. Use the one from your invitation email, or ask an admin to invite you again.';
  }
  if (/no registered\/verified email/i.test(message)) {
    return 'This account’s email was never confirmed. Sign in with your password to get a new confirmation code.';
  }
  // Same message whether the email exists or not, so the form never reveals who has an account.
  if (name === 'NotAuthorizedException' || name === 'UserNotFoundException') {
    return 'Incorrect email or password.';
  }
  if (name === 'UsernameExistsException') {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (name === 'CodeMismatchException') {
    return 'That code is not right. Check the email and type it again.';
  }
  if (name === 'ExpiredCodeException') {
    return 'That code has expired. Ask for a new one below.';
  }
  if (name === 'InvalidParameterException' && /email/i.test(message)) {
    return 'Enter a valid email address, like name@example.com.';
  }
  if (name === 'InvalidPasswordException') {
    return 'Choose a password with at least 12 characters.';
  }
  if (name === 'NetworkError' || /network/i.test(message)) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return 'Something went wrong. Please try again.';
}
