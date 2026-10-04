import { Amplify } from 'aws-amplify';
import {
  confirmSignIn,
  confirmSignUp as amplifyConfirmSignUp,
  fetchAuthSession,
  resendSignUpCode as amplifyResendSignUpCode,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  signUp as amplifySignUp,
} from 'aws-amplify/auth';

export interface SessionUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

export type SignInStep = 'signedIn' | 'newPasswordRequired' | 'confirmEmail' | 'unsupported';

let configured = false;

// Browser-only: Amplify keeps the session in the browser's storage.
function configure() {
  if (configured) return;
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID!,
        userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID!,
      },
    },
  });
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
    // A stale session from another tab: clear it and try once more.
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
