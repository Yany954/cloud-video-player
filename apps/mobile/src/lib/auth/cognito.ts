// Amplify signs in with SRP, which needs secure random numbers; React Native gets them from
// this polyfill, which must load before Amplify does.
import 'react-native-get-random-values';
import { Amplify } from 'aws-amplify';
import {
  confirmResetPassword,
  confirmSignIn,
  confirmSignUp as amplifyConfirmSignUp,
  fetchAuthSession,
  resendSignUpCode as amplifyResendSignUpCode,
  resetPassword,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  signUp as amplifySignUp,
  updatePassword as amplifyUpdatePassword,
} from 'aws-amplify/auth';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import { env } from '../env';
import { secureStorage } from './secure-storage';

export interface SessionUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

export type SignInStep = 'signedIn' | 'newPasswordRequired' | 'confirmEmail' | 'unsupported';

let configured = false;

// The session is kept in the phone's secure storage (Keychain / Keystore), not in plain files.
function configure() {
  if (configured) return;
  Amplify.configure({
    Auth: {
      Cognito: { userPoolId: env.userPoolId, userPoolClientId: env.userPoolClientId },
    },
  });
  cognitoUserPoolsTokenProvider.setKeyValueStorage(secureStorage);
  configured = true;
}

function toStep(signInStep: string): SignInStep {
  if (signInStep === 'DONE') return 'signedIn';
  if (signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') return 'newPasswordRequired';
  // The account exists but its email address was never confirmed with the emailed code.
  if (signInStep === 'CONFIRM_SIGN_UP') return 'confirmEmail';
  return 'unsupported';
}

export async function signIn(email: string, password: string): Promise<SignInStep> {
  configure();
  try {
    const { nextStep } = await amplifySignIn({ username: email, password });
    return toStep(nextStep.signInStep);
  } catch (error) {
    // A stale session left on the phone: clear it and try once more.
    if (error instanceof Error && error.name === 'UserAlreadyAuthenticatedException') {
      await amplifySignOut();
      const { nextStep } = await amplifySignIn({ username: email, password });
      return toStep(nextStep.signInStep);
    }
    throw error;
  }
}

/** Finishes the first sign-in of an invited user, who must replace the temporary password. */
export async function completeNewPassword(newPassword: string): Promise<SignInStep> {
  configure();
  const { nextStep } = await confirmSignIn({ challengeResponse: newPassword });
  return toStep(nextStep.signInStep);
}

/** Creates an account. Cognito emails a code that `confirmSignUp` needs. */
export async function signUp(email: string, password: string): Promise<void> {
  configure();
  await amplifySignUp({ username: email, password, options: { userAttributes: { email } } });
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  configure();
  await amplifyConfirmSignUp({ username: email, confirmationCode: code });
}

export async function resendSignUpCode(email: string): Promise<void> {
  configure();
  await amplifyResendSignUpCode({ username: email });
}

/**
 * Emails a code for choosing a new password. Cognito answers the same way whether or not the
 * address has an account, so this never reveals who is registered.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  configure();
  await resetPassword({ username: email });
}

export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  configure();
  await confirmResetPassword({ username: email, confirmationCode: code, newPassword });
}

/** Changes the signed-in user's password. Cognito checks the current one. */
export async function changePassword(current: string, next: string): Promise<void> {
  configure();
  await amplifyUpdatePassword({ oldPassword: current, newPassword: next });
}

export async function signOut(): Promise<void> {
  configure();
  await amplifySignOut();
}

export async function getSessionUser(): Promise<SessionUser | null> {
  configure();
  const { tokens } = await fetchAuthSession();
  if (!tokens?.idToken) return null;
  const groups = tokens.accessToken.payload['cognito:groups'];
  return {
    id: String(tokens.accessToken.payload.sub),
    email: String(tokens.idToken.payload.email ?? ''),
    isAdmin: Array.isArray(groups) && groups.includes('admin'),
  };
}

/** A valid access token for API calls. Amplify refreshes it when it has expired. */
export async function getAccessToken(): Promise<string | null> {
  configure();
  const { tokens } = await fetchAuthSession();
  return tokens?.accessToken.toString() ?? null;
}
