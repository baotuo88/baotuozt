import type { AbTestRepository, AbTestRow } from './ab-test.types';

export interface PgClientLike {
  query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

export class AbTestPgRepository implements AbTestRepository {
  constructor(private readonly pg: PgClientLike) {}

  async upsertImage(imageId: number): Promise<void> {
    await this.pg.query(
      `INSERT INTO ab_tests (image_id, clicks)
       VALUES ($1, 0)
       ON CONFLICT (image_id) DO NOTHING`,
      [imageId],
    );
  }

  async incrementClicks(imageId: number): Promise<void> {
    await this.pg.query(
      `INSERT INTO ab_tests (image_id, clicks)
       VALUES ($1, 1)
       ON CONFLICT (image_id)
       DO UPDATE SET clicks = ab_tests.clicks + 1`,
      [imageId],
    );
  }

  async findByImageIds(imageIds: number[]): Promise<AbTestRow[]> {
    if (imageIds.length === 0) {
      return [];
    }

    const result = await this.pg.query<AbTestRow>(
      `SELECT image_id, clicks
       FROM ab_tests
       WHERE image_id = ANY($1::bigint[])`,
      [imageIds],
    );

    return result.rows;
  }
}
