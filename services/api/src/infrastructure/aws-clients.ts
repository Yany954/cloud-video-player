import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { SQSClient } from '@aws-sdk/client-sqs';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export const s3ClientConfig = {
  // By default the SDK bakes a CRC32 checksum into presigned URLs, which a browser or app
  // PUTting raw bytes can't satisfy. Only add checksums where S3 requires them.
  requestChecksumCalculation: 'WHEN_REQUIRED',
} satisfies S3ClientConfig;

// Created once per Lambda container and reused across invocations.
export const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
export const s3Client = new S3Client(s3ClientConfig);
export const sqsClient = new SQSClient({});
