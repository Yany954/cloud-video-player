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
// The browser origins allowed to call the API and to upload to the bucket: local development
// and the web app on Amplify Hosting.
const webOrigins = ['http://localhost:3000', 'https://main.d1fywgy7g1rdyk.amplifyapp.com'];

const webUrl = 'https://main.d1fywgy7g1rdyk.amplifyapp.com';
const auth = new AuthStack(app, `${prefix}-auth`, { env, prefix, webUrl });
const data = new DataStack(app, `${prefix}-data`, { env, prefix });
const storage = new StorageStack(app, `${prefix}-storage`, { env, webOrigins });
const processing = new ProcessingStack(app, `${prefix}-processing`, {
  env,
  prefix,
  table: data.table,
  uploadsBucket: storage.uploadsBucket,
  mediaBucket: storage.mediaBucket,
  userPool: auth.userPool,
});
new ApiStack(app, `${prefix}-api`, {
  env,
  prefix,
  webOrigins,
  userPool: auth.userPool,
  appClient: auth.appClient,
  table: data.table,
  uploadsBucket: storage.uploadsBucket,
  mediaBucket: storage.mediaBucket,
  processingQueue: processing.queue,
  deletionQueue: processing.deletionQueue,
  playbackDomain: storage.mediaDistribution.distributionDomainName,
  playbackKeyPairId: storage.playbackKeyPairId,
  playbackKeyParameter: `/${prefix}/playback/private-key`,
});

app.synth();
