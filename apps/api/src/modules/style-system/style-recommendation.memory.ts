import type { GenerateMode } from './generate-prompt';
import type { StyleProfile, StyleRecommendationRepository } from './style-recommendation.service';

export class StyleRecommendationMemoryRepository implements StyleRecommendationRepository {
  constructor(private readonly styles: StyleProfile[]) {}

  async listByMode(mode: GenerateMode): Promise<StyleProfile[]> {
    return this.styles.filter((style) => style.mode === mode);
  }
}
