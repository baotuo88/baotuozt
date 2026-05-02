import type { StyleGateway, UserGateway, UserSnapshot } from './generate-image-task';
import type { StyleConfig } from '../style-system';

export interface PgClientLike {
  query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

interface UserRow {
  id: number;
  status: 'active' | 'disabled' | 'banned' | string;
  feature_flags?: unknown;
}

interface StyleRow {
  id: number;
  version?: number;
  prompt_template?: string | null;
  lighting?: string | null;
  composition?: string | null;
  camera?: string | null;
  details?: string | null;
  color_style?: string | null;
  quality_booster?: string | null;
  negative_prompt?: string | null;
}

export class UserPgGateway implements UserGateway {
  constructor(private readonly pg: PgClientLike) {}

  async findById(userId: number): Promise<UserSnapshot | null> {
    const result = await this.pg.query<UserRow>(
      `SELECT id, status, feature_flags
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );
    const row = result.rows[0];
    return row ?? null;
  }
}

export class StylePgGateway implements StyleGateway {
  constructor(private readonly pg: PgClientLike) {}

  async findById(styleId: number): Promise<StyleConfig | null> {
    const result = await this.pg.query<StyleRow>(
      `SELECT
         id,
         version,
         prompt_template,
         lighting,
         composition,
         camera,
         details,
         color_style,
         quality_booster,
         negative_prompt
       FROM styles
       WHERE id = $1
       LIMIT 1`,
      [styleId],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      version: row.version,
      prompt_template: row.prompt_template,
      lighting: row.lighting,
      composition: row.composition,
      camera: row.camera,
      details: row.details,
      color_style: row.color_style,
      quality_booster: row.quality_booster,
      negative_prompt: row.negative_prompt,
    };
  }
}

