import crypto from 'crypto';

export interface ImageCacheItem {
  prompt_hash: string;
  image_url: string;
}

export interface BuildPromptHashInput {
  prompt: string;
  negative_prompt?: string | null;
  image_url?: string | null;
  model_type?: string | null;
  mode?: string | null;
  style_version?: number | null;
}

export interface ImageCacheRepository {
  findByHash(promptHash: string): Promise<ImageCacheItem | null>;
  upsert(item: ImageCacheItem): Promise<void>;
}

function normalizeText(value?: string | null): string {
  return (value ?? '').trim();
}

function normalizeUrl(value?: string | null): string {
  return (value ?? '').trim();
}

export function buildPromptHash(input: string | BuildPromptHashInput): string {
  if (typeof input === 'string') {
    return crypto.createHash('md5').update(input.trim()).digest('hex');
  }

  const payload = [
    normalizeText(input.prompt),
    normalizeText(input.negative_prompt),
    normalizeUrl(input.image_url),
    normalizeText(input.model_type),
    normalizeText(input.mode),
    typeof input.style_version === 'number' ? String(input.style_version) : '',
  ].join('\n');

  return crypto.createHash('md5').update(payload).digest('hex');
}

export class ImageCacheService {
  constructor(private readonly repository: ImageCacheRepository) {}

  async getByPrompt(input: string | BuildPromptHashInput): Promise<ImageCacheItem | null> {
    const promptHash = buildPromptHash(input);
    return this.repository.findByHash(promptHash);
  }

  async saveByPrompt(input: string | BuildPromptHashInput, imageUrl: string): Promise<void> {
    const promptHash = buildPromptHash(input);
    await this.repository.upsert({
      prompt_hash: promptHash,
      image_url: imageUrl,
    });
  }
}
