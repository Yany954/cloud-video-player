import { useLocalSearchParams } from 'expo-router';
import { AuthFlow } from '@/components/auth-flow';

/** Sign in, or straight to "create an account" when the welcome screen's main button led here. */
export default function SignInScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return <AuthFlow startAt={mode === 'create' ? 'signUp' : 'credentials'} />;
}
