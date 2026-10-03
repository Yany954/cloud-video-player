'use client';

import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';
import * as cognito from './cognito';
import type { SessionUser, SignInStep } from './cognito';

type AuthState =
  { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: SessionUser };

interface AuthContextValue {
  state: AuthState;
  signIn(email: string, password: string): Promise<SignInStep>;
  completeNewPassword(newPassword: string): Promise<SignInStep>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    const user = await cognito.getSessionUser().catch(() => null);
    setState(user ? { status: 'signedIn', user } : { status: 'signedOut' });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      async signIn(email, password) {
        const step = await cognito.signIn(email, password);
        if (step === 'signedIn') await refresh();
        return step;
      },
      async completeNewPassword(newPassword) {
        const step = await cognito.completeNewPassword(newPassword);
        if (step === 'signedIn') await refresh();
        return step;
      },
      async signOut() {
        await cognito.signOut();
        setState({ status: 'signedOut' });
      },
    }),
    [state, refresh],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
