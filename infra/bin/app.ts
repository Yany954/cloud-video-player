import { App } from 'aws-cdk-lib';
import { AuthStack } from '../lib/auth-stack';
import { DataStack } from '../lib/data-stack';
import { StorageStack } from '../lib/storage-stack';

const app = new App();

// Account comes from the CLI profile (--profile cvp-dev), so it is never hardcoded in the repo.
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' };
const prefix = 'cvp-dev';

new AuthStack(app, `${prefix}-auth`, { env, prefix });
new DataStack(app, `${prefix}-data`, { env, prefix });
new StorageStack(app, `${prefix}-storage`, {
  env,
  // Add the Amplify domain here once the web app is deployed (Phase 4).
  webOrigins: ['http://localhost:3000'],
});

app.synth();
