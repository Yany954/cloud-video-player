import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { AuthStack } from '../lib/auth-stack';

describe('AuthStack', () => {
  let template: Template;

  beforeAll(() => {
    const stack = new AuthStack(new App(), 'TestAuth', { prefix: 'test' });
    template = Template.fromStack(stack);
  });

  it('is invite-only (no self sign-up)', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
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
});
