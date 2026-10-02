import { App } from 'aws-cdk-lib';
import { AuthStack } from '../lib/auth-stack';

const app = new App();

// Account comes from the CLI profile (--profile cvp-dev), so it is never hardcoded in the repo.
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' };
const prefix = 'cvp-dev';

new AuthStack(app, `${prefix}-auth`, { env, prefix });

app.synth();
