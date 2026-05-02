import type { StyleConfig } from './generate-prompt';

export interface StyleEntity extends StyleConfig {
  id: number;
  name: string;
  category: 'ecommerce' | 'social' | 'portrait' | 'general';
  version: number;
  created_at?: string;
}

export interface UpdateStyleInput {
  style_id: number;
  patch: Partial<Pick<StyleEntity, 'prompt_template' | 'lighting' | 'composition' | 'camera' | 'details' | 'color_style' | 'quality_booster' | 'negative_prompt'>>;
}

export interface StyleVersionRepository {
  findLatestByStyleId(styleId: number): Promise<StyleEntity | null>;
  createNewVersion(data: Omit<StyleEntity, 'created_at'>): Promise<StyleEntity>;
}

export class StyleVersionService {
  constructor(private readonly repository: StyleVersionRepository) {}

  async updateStyleAsNewVersion(input: UpdateStyleInput): Promise<StyleEntity> {
    const current = await this.repository.findLatestByStyleId(input.style_id);
    if (!current) {
      throw new Error('STYLE_NOT_FOUND');
    }

    const next: Omit<StyleEntity, 'created_at'> = {
      ...current,
      ...input.patch,
      id: current.id,
      version: current.version + 1,
    };

    return this.repository.createNewVersion(next);
  }
}
