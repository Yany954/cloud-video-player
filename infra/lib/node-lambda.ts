import { fileURLToPath } from 'node:url';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import {
  NodejsFunction,
  OutputFormat,
  type NodejsFunctionProps,
} from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

const apiSrc = fileURLToPath(new URL('../../services/api/src/', import.meta.url));

export interface NodeLambdaProps extends Omit<NodejsFunctionProps, 'entry'> {
  /** Handler file, relative to services/api/src. */
  entry: string;
}

/** A Lambda built from services/api with the settings every function here shares. */
export function nodeLambda(scope: Construct, name: string, props: NodeLambdaProps): NodejsFunction {
  return new NodejsFunction(scope, name, {
    handler: 'handler',
    runtime: Runtime.NODEJS_22_X,
    architecture: Architecture.ARM_64,
    memorySize: 256,
    timeout: Duration.seconds(10),
    bundling: {
      format: OutputFormat.ESM,
      minify: true,
      sourceMap: true,
      mainFields: ['module', 'main'],
      // Ship the AWS SDK version we test with instead of whatever the runtime has.
      externalModules: [],
      // Some dependencies still call require(), which ESM output doesn't define.
      banner:
        "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
    logGroup: new LogGroup(scope, `${name}Logs`, {
      retention: RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    }),
    ...props,
    entry: apiSrc + props.entry,
  });
}
