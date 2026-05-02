import { promises as fs } from 'fs';
import path from 'path';
import type { UploadStorage } from './upload.types';

export interface LocalUploadStorageConfig {
  baseDir: string;
  publicBaseUrl: string;
}

export class LocalUploadStorage implements UploadStorage {
  constructor(private readonly config: LocalUploadStorageConfig) {}

  async upload(input: { key: string; body: Buffer; content_type: string }): Promise<{ url: string }> {
    const fullPath = path.join(this.config.baseDir, input.key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.body);

    const normalizedKey = input.key.replace(/^\/+/, '');
    const base = this.config.publicBaseUrl.replace(/\/$/, '');
    return {
      url: `${base}/${normalizedKey}`,
    };
  }
}

