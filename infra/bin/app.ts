import { App } from 'aws-cdk-lib';
import { ApiStack } from '../lib/api-stack';
import { AuthStack } from '../lib/auth-stack';
import { DataStack } from '../lib/data-stack';
import { StorageStack } from '../lib/storage-stack';

const app = new App();

// Account comes from the CLI profile (--profile cvp-dev), so it is never hardcoded in the repo.
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' };
const prefix = 'cvp-dev';
// Add the Amplify domain here once the web app is deployed (Phase 4).
const webOrigins = ['http://localhost:3000'];

const auth = new AuthStack(app, `${prefix}-auth`, { env, prefix });
const data = new DataStack(app, `${prefix}-data`, { env, prefix });
const storage = new StorageStack(app, `${prefix}-storage`, { env, webOrigins });
new ApiStack(app, `${prefix}-api`, {
  env,
  prefix,
  webOrigins,
  userPool: auth.userPool,
  appClient: auth.appClient,
  table: data.table,
  uploadsBucket: storage.uploadsBucket,
});

app.synth();
