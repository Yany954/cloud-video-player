import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { AuthStack } from '../lib/auth-stack';

describe('AuthStack', () => {
  let template: Template;

  beforeAll(() => {
    const stack = new AuthStack(new App(), 'TestAuth', {
      prefix: 'test',
      webUrl: 'https://app.test',
    });
    template = Template.fromStack(stack);
  });

  it('lets anyone sign up, but only with an email address confirmed by a code', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: false },
      AutoVerifiedAttributes: ['email'],
      VerificationMessageTemplate: { DefaultEmailOption: 'CONFIRM_WITH_CODE' },
    });
  });

  it('uses a case-insensitive email as the username', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UsernameAttributes: ['email'],
      UsernameConfiguration: { CaseSensitive: false },
    });
  });

  it('requires only the email attribute', () => {
    const pools = template.findResources('AWS::Cognito::UserPool');
    const schema = Object.values(pools)[0]?.Properties.Schema as {
      Name: string;
      Required: boolean;
    }[];
    expect(schema.filter((attr) => attr.Required).map((attr) => attr.Name)).toEqual(['email']);
  });

  it('recovers accounts by email only, never SMS', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AccountRecoverySetting: {
        RecoveryMechanisms: [{ Name: 'verified_email', Priority: 1 }],
      },
      MfaConfiguration: 'OPTIONAL',
      EnabledMfas: ['SOFTWARE_TOKEN_MFA'],
    });
  });

  it('is protected against deletion', () => {
    template.hasResource('AWS::Cognito::UserPool', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
      Properties: Match.objectLike({ DeletionProtection: 'ACTIVE' }),
    });
  });

  it.each(['admin', 'user'])('creates the %s group', (groupName) => {
    template.hasResourceProperties('AWS::Cognito::UserPoolGroup', { GroupName: groupName });
  });

  it('sends its emails in English and Spanish, with each placeholder exactly once', () => {
    const pool = Object.values(template.findResources('AWS::Cognito::UserPool'))[0]!.Properties;
    const code: string = pool.VerificationMessageTemplate.EmailMessage;
    const invitation: string = pool.AdminCreateUserConfig.InviteMessageTemplate.EmailMessage;
    const count = (text: string, part: string) => text.split(part).length - 1;

    expect(count(code, '{####}')).toBe(1);
    expect(code).toContain('Type it in the app');
    expect(code).toContain('Escríbelo en la aplicación');

    expect(count(invitation, '{####}')).toBe(1);
    expect(count(invitation, '{username}')).toBe(1);
    expect(invitation).toContain('You have been invited');
    expect(invitation).toContain('Te invitaron');
    // The link people follow to sign in for the first time.
    expect(invitation).toContain('https://app.test/login');

    expect(pool.VerificationMessageTemplate.EmailSubject.length).toBeLessThanOrEqual(140);
    expect(
      pool.AdminCreateUserConfig.InviteMessageTemplate.EmailSubject.length,
    ).toBeLessThanOrEqual(140);
  });
});
