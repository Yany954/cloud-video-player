import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { AccountRecovery, FeaturePlan, Mfa, UserPool } from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';

export interface AuthStackProps extends StackProps {
  prefix: string;
}

export class AuthStack extends Stack {
  readonly userPool: UserPool;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    this.userPool = new UserPool(this, 'UserPool', {
      userPoolName: `${props.prefix}-users`,
      featurePlan: FeaturePlan.ESSENTIALS,

      // Permanent after creation: email is the username, case-insensitive, and the only required attribute.
      signInAliases: { email: true },
      signInCaseSensitive: false,
      standardAttributes: { email: { required: true, mutable: true } },

      // Invite-only MVP: admins create users, nobody signs up on their own.
      selfSignUpEnabled: false,
      autoVerify: { email: true },
      userInvitation: {
        emailSubject: 'You are invited to Cloud Video Player',
        emailBody:
          'You have been invited to Cloud Video Player.<br>Username: {username}<br>Temporary password: {####}<br>You will be asked to choose a new password on first sign-in.',
      },

      // Length over composition rules (NIST SP 800-63B).
      passwordPolicy: {
        minLength: 12,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
        tempPasswordValidity: Duration.days(7),
      },
      mfa: Mfa.OPTIONAL,
      mfaSecondFactor: { otp: true, sms: false },
      accountRecovery: AccountRecovery.EMAIL_ONLY,

      // Users must survive a mistaken `cdk destroy`.
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.userPool.addGroup('AdminGroup', {
      groupName: 'admin',
      description: 'Moderates content, manages users and categories; also uploads and watches',
      precedence: 0,
    });
    this.userPool.addGroup('UserGroup', {
      groupName: 'user',
      description: 'Uploads own videos (pending until approved) and watches',
      precedence: 10,
    });

    new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
  }
}
