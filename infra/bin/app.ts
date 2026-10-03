import { App } from 'aws-cdk-lib';
import { ApiStack } from '../lib/api-stack';
import { AuthStack } from '../lib/auth-stack';
import { DataStack } from '../lib/data-stack';
import { ProcessingStack } from '../lib/processing-stack';
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
const processing = new ProcessingStack(app, `${prefix}-processing`, {
  env,
  prefix,
  table: data.table,
  uploadsBucket: storage.uploadsBucket,
  mediaBucket: storage.mediaBucket,
});
new ApiStack(app, `${prefix}-api`, {
  env,
  prefix,
  webOrigins,
  userPool: auth.userPool,
  appClient: auth.appClient,
  table: data.table,
  uploadsBucket: storage.uploadsBucket,
  processingQueue: processing.queue,
  playbackDomain: storage.mediaDistribution.distributionDomainName,
  playbackKeyPairId: storage.playbackKeyPairId,
  playbackKeyParameter: `/${prefix}/playback/private-key`,
});

app.synth();
