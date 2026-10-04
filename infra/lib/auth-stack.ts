import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import {
  AccountRecovery,
  FeaturePlan,
  Mfa,
  UserPool,
  VerificationEmailStyle,
  type UserPoolClient,
} from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';

export interface AuthStackProps extends StackProps {
  prefix: string;
  /** Address of the web app, for the link in invitation emails. */
  webUrl: string;
}

// Cognito sends one template to everyone, so every email carries English and Spanish. Each
// placeholder ({####}, {username}) appears exactly once.
const codeEmail = {
  subject: 'Your Cloud Video Player code / Tu código de Cloud Video Player',
  body: [
    '<p style="font-size:20px"><strong>{####}</strong></p>',
    '<p>This is your Cloud Video Player code. Type it in the app to continue. If you did not ask for it, you can ignore this email.</p>',
    '<p>Este es tu código de Cloud Video Player. Escríbelo en la aplicación para continuar. Si no lo pediste, puedes ignorar este correo.</p>',
  ].join(''),
};
const invitationEmail = (webUrl: string) => ({
  subject: 'You are invited to Cloud Video Player / Te invitaron a Cloud Video Player',
  body: [
    '<p>Email / Correo: <strong>{username}</strong><br>Temporary password / Contraseña temporal: <strong>{####}</strong></p>',
    `<p>You have been invited to Cloud Video Player, a private place for the videos you film at concerts and events. Sign in at <a href="${webUrl}/login">${webUrl}/login</a> with the temporary password above; you will be asked to choose your own. It works for 7 days.</p>`,
    `<p>Te invitaron a Cloud Video Player, un lugar privado para los videos que grabas en conciertos y eventos. Inicia sesión en <a href="${webUrl}/login">${webUrl}/login</a> con la contraseña temporal de arriba; se te pedirá elegir una propia. Sirve durante 7 días.</p>`,
  ].join(''),
});

export class AuthStack extends Stack {
  readonly userPool: UserPool;
  readonly appClient: UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    this.userPool = new UserPool(this, 'UserPool', {
      userPoolName: `${props.prefix}-users`,
      featurePlan: FeaturePlan.ESSENTIALS,

      // Permanent after creation: email is the username, case-insensitive, and the only required attribute.
      signInAliases: { email: true },
      signInCaseSensitive: false,
      standardAttributes: { email: { required: true, mutable: true } },

      // Anyone can create an account (decided by the owner, so people invited to an event can
      // join by themselves). The email address must be confirmed with a code before first use.
      selfSignUpEnabled: true,
      autoVerify: { email: true },
      userVerification: {
        emailStyle: VerificationEmailStyle.CODE,
        // Also used for the password-reset code.
        emailSubject: codeEmail.subject,
        emailBody: codeEmail.body,
      },
      userInvitation: {
        emailSubject: invitationEmail(props.webUrl).subject,
        emailBody: invitationEmail(props.webUrl).body,
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

    // Public client shared by web and mobile: apps can't keep a secret, so none is generated.
    this.appClient = this.userPool.addClient('AppClient', {
      userPoolClientName: `${props.prefix}-app`,
      generateSecret: false,
      authFlows: {
        userSrp: true,
        // Needs AWS credentials, so only usable from dev scripts, never from the apps.
        adminUserPassword: true,
      },
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
    });

    new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new CfnOutput(this, 'AppClientId', { value: this.appClient.userPoolClientId });
  }
}
