// The source language. `es.ts` must have the same shape (checked by the compiler).
// The `auth` and `authErrors` texts match the website's, so both say the same thing.
// Texts that take values are functions, so each language orders the words its own way.
export const en = {
  common: {
    appName: 'Cloud Video Player',
    tryAgain: 'Check your connection and try again.',
    loading: 'Loading',
    back: 'Back',
    show: 'Show',
    hide: 'Hide',
  },
  legal: {
    privacy: 'Privacy policy',
    terms: 'Terms of service',
    consentBefore: 'I am at least 13 years old, and I agree to the',
    consentBetween: 'and the',
    consentAfter: '.',
    consentMissing: 'Tick the box to create your account.',
    opensInBrowser: '(opens in the browser)',
  },
  tabs: {
    yourVideos: 'Your videos',
    events: 'Events',
    shared: 'Shared with me',
    account: 'Account',
  },
  lists: {
    pullToRetry: 'Pull down to try again.',
    play: (title: string) => `Play ${title}`,
    videosLoadError: 'Your videos could not be loaded.',
    videosEmptyTitle: 'No videos yet',
    videosEmptyText:
      'The videos you upload will be listed here. Uploading from the phone arrives in a later step; for now, upload on the website.',
    sharedIntro:
      'Videos other people added to the events you belong to. Nobody sees your videos unless you put them in an event and invite them.',
    sharedLoadError: 'These videos could not be loaded.',
    sharedEmptyTitle: 'Nothing shared with you yet',
    sharedEmptyText:
      'When someone invites you to an event, or adds a video to one of yours, it will be listed here.',
  },
  events: {
    loadError: 'Your events could not be loaded.',
    mine: 'My events',
    mineEmpty: 'You have no events yet. Create one on the website, then add your videos to it.',
    invited: 'Events I was invited to',
    open: (name: string) => `Open ${name}`,
    private: 'Private',
  },
  event: {
    notFound: 'This event does not exist, or you were not invited to it.',
    loadFailed: 'The event could not be loaded.',
    videosTitle: 'Videos, in playing order',
    emptyTitle: 'No videos in this event yet',
    emptyVisitor: 'Its videos will be listed here once they are approved.',
    count: (count: number) => (count === 1 ? '1 video' : `${count} videos`),
  },
  player: {
    notFound: 'This video does not exist.',
    stillPreparing: 'This video is still being prepared. Try again in a moment.',
    loadFailed: 'The video could not be loaded.',
    loading: 'Loading video',
    cannotPlay: 'This video could not be played. Check your connection and try again.',
    retry: 'Try again',
  },
  account: {
    signedInAs: 'Signed in as',
    admin: 'Administrator',
    signOut: 'Sign out',
    more: 'Profile, storage and uploads are on the website for now.',
  },
  videoStatus: {
    uploadNotFinished: 'Upload not finished',
    beingPrepared: 'Being prepared',
    notApproved: 'Not approved',
    beingReviewed: 'Being reviewed',
    waitingForReview: 'Waiting for review',
    readyToWatch: 'Ready to watch',
    failed: {
      UNSUPPORTED_VIDEO_CODEC: 'Format not supported yet',
      TOO_LARGE: 'Too large to process yet',
      NO_VIDEO_STREAM: 'No video found in the file',
      PROCESSING_ERROR: 'Could not be processed',
    },
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
