import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { UploadStorage } from '../upload';
import type { S3Storage } from '../generator/queue';

export interface S3StorageConfig {
  region: string;
  bucket: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicBaseUrl?: string;
}

function trimRightSlash(input: string): string {
  return input.replace(/\/+$/, '');
}

export class AwsS3Storage implements UploadStorage, S3Storage {
  private readonly s3: S3Client;

  constructor(private readonly config: S3StorageConfig) {
    this.s3 = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle ?? false,
      credentials: config.accessKeyId && config.secretAccessKey
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }
        : undefined,
    });
  }

  async upload(input: { key: string; body: Buffer; content_type: string }): Promise<{ url: string }> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.content_type,
      }),
    );

    const normalizedKey = input.key.replace(/^\/+/, '');

    if (this.config.publicBaseUrl) {
      return {
        url: `${trimRightSlash(this.config.publicBaseUrl)}/${normalizedKey}`,
      };
    }

    return {
      url: `https://${this.config.bucket}.s3.amazonaws.com/${normalizedKey}`,
    };
  }
}
