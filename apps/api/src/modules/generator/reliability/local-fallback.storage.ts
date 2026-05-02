import { promises as fs } from 'fs';
import path from 'path';
import type { FallbackStorage } from '../queue';

export interface LocalFallbackStorageConfig {
  baseDir: string;
  publicBaseUrl: string;
}

export class LocalFallbackStorage implements FallbackStorage {
  constructor(private readonly config: LocalFallbackStorageConfig) {}

  async upload(input: { key: string; body: Buffer; content_type: string }): Promise<{ url: string }> {
    const fullPath = path.join(this.config.baseDir, input.key);
    const dir = path.dirname(fullPath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, input.body);

    const normalizedKey = input.key.replace(/^\/+/, '');
    const base = this.config.publicBaseUrl.replace(/\/$/, '');
    return { url: `${base}/${normalizedKey}` };
  }
}
