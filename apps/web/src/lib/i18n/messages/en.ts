// English texts: the source of truth. `es.ts` must have exactly the same shape (a test checks it).
// Texts that take values are functions, so each language orders the words its own way.

export const en = {
  common: {
    appName: 'Cloud Video Player',
    skipToContent: 'Skip to content',
    loading: 'Loading',
  },
  theme: {
    switchToDark: 'Switch to dark mode',
    switchToLight: 'Switch to light mode',
    legend: 'Colours',
    system: 'Match my device',
    light: 'Light',
    dark: 'Dark',
  },
  language: {
    label: 'Language',
  },
  nav: {
    label: 'Main',
    yourVideos: 'Your videos',
    events: 'Events',
    library: 'Library',
    review: 'Review',
    users: 'Users',
    profile: 'Profile',
    profileOf: (email: string) => `Profile of ${email}`,
    signOut: 'Sign out',
  },
  loginPage: {
    title: 'Sign in | Cloud Video Player',
    privacyNote:
      'Videos here are private. You see only your own, the events you were invited to, and what the library’s admins approved.',
    asideTitle: 'Every show you filmed, in one private place.',
    asideText: 'Original quality, off your phone, and only the people you invite can watch.',
  },
  auth: {
    email: 'Email',
    password: 'Password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    passwordHint: (min: number) => `At least ${min} characters. A few random words work well.`,
    passwordsDoNotMatch: 'The passwords do not match.',
    unsupportedStep: 'This account needs a sign-in step this app does not support yet.',
    signIn: {
      title: 'Sign in',
      intro: 'Use the email address and password of your account.',
      submit: 'Sign in',
      submitting: 'Signing in',
      cantSignIn: 'Can’t sign in?',
      resetPassword: 'Reset your password',
      newHere: 'New here?',
      createAccount: 'Create an account',
    },
    signUp: {
      title: 'Create your account',
      intro: 'We will email you a code to confirm the address is yours.',
      repeatPassword: 'Repeat password',
      submit: 'Create account',
      submitting: 'Creating account',
      haveAccount: 'Already have an account?',
      signIn: 'Sign in',
    },
    confirmEmail: {
      title: 'Check your email',
      introBefore: 'We sent a 6-digit code to',
      introAfter: '. It can take a minute, and it may be in your spam folder.',
      code: 'Confirmation code',
      submit: 'Confirm and sign in',
      submitting: 'Confirming',
      noEmail: 'No email yet?',
      resend: 'Send a new code',
      resent: 'A new code is on its way.',
    },
    forgot: {
      title: 'Forgot your password?',
      intro: 'Enter your email and we will send you a code to choose a new one.',
      submit: 'Send code',
      submitting: 'Sending',
      remembered: 'Remembered it?',
      signIn: 'Sign in',
    },
    reset: {
      title: 'Choose a new password',
      introBefore: 'If',
      introAfter:
        'has an account, we sent it a 6-digit code. It can take a minute, and it may be in your spam folder.',
      code: 'Code from the email',
      newPassword: 'New password',
      repeatNewPassword: 'Repeat new password',
      submit: 'Save and sign in',
      submitting: 'Saving',
      noEmail: 'No email yet?',
      resend: 'Send a new code',
    },
    newPassword: {
      title: 'Choose your password',
      intro: 'Your temporary password worked. Now pick one that only you know.',
      newPassword: 'New password',
      repeatNewPassword: 'Repeat new password',
      submit: 'Save and continue',
      submitting: 'Saving',
    },
  },
  authErrors: {
    tooManyAttempts: 'Too many attempts. Wait a few minutes and try again.',
    stillTemporaryPassword:
      'This account still has its temporary password. Use the one from your invitation email, or ask an admin to invite you again.',
    emailNeverConfirmed:
      'This account’s email was never confirmed. Sign in with your password to get a new confirmation code.',
    incorrectCredentials: 'Incorrect email or password.',
    accountExists: 'An account with this email already exists. Sign in instead.',
    wrongCode: 'That code is not right. Check the email and type it again.',
    expiredCode: 'That code has expired. Ask for a new one below.',
    invalidEmail: 'Enter a valid email address, like name@example.com.',
    passwordTooShort: 'Choose a password with at least 12 characters.',
    network: 'Can’t reach the server. Check your connection and try again.',
    unknown: 'Something went wrong. Please try again.',
  },
};

/** The shape every language must have: same keys; texts stay texts, functions keep their arguments. */
type Shape<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => string
    ? (...args: A) => string
    : T[K] extends string
      ? string
      : Shape<T[K]>;
};
export type Messages = Shape<typeof en>;
