import type { ImageCacheItem, ImageCacheRepository } from './image-cache.service';

export interface PgClientLike {
  query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

export class ImageCachePgRepository implements ImageCacheRepository {
  constructor(private readonly pg: PgClientLike) {}

  async findByHash(promptHash: string): Promise<ImageCacheItem | null> {
    const result = await this.pg.query<ImageCacheItem>(
      `SELECT prompt_hash, image_url
       FROM image_cache
       WHERE prompt_hash = $1
       LIMIT 1`,
      [promptHash],
    );

    return result.rows[0] ?? null;
  }

  async upsert(item: ImageCacheItem): Promise<void> {
    await this.pg.query(
      `INSERT INTO image_cache (prompt_hash, image_url)
       VALUES ($1, $2)
       ON CONFLICT (prompt_hash)
       DO UPDATE SET
         image_url = EXCLUDED.image_url,
         updated_at = NOW()`,
      [item.prompt_hash, item.image_url],
    );
  }
}
