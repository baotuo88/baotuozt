import type { GenerateMode } from './generate-prompt';

export interface StyleProfile {
  id: number;
  name: string;
  mode: GenerateMode;
  tags: string[];
}

export interface StyleRecommendationInput {
  user_input: string;
  mode: GenerateMode;
}

export interface StyleRecommendationResult {
  id: number;
  name: string;
  score: number;
  matched_tags: string[];
}

export interface StyleRecommendationRepository {
  listByMode(mode: GenerateMode): Promise<StyleProfile[]>;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,，、;；|/]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function scoreTags(keywords: string[], tags: string[]): { score: number; matched: string[] } {
  const normalizedTags = tags.map((t) => t.toLowerCase().trim()).filter(Boolean);
  const matched = normalizedTags.filter((tag) => keywords.some((k) => tag.includes(k) || k.includes(tag)));

  if (keywords.length === 0 || normalizedTags.length === 0) {
    return { score: 0, matched: [] };
  }

  const unionSize = new Set([...keywords, ...normalizedTags]).size;
  const jaccard = matched.length / unionSize;
  const overlapBoost = matched.length / Math.max(keywords.length, 1);
  const score = jaccard * 0.7 + overlapBoost * 0.3;

  return { score, matched };
}

export class StyleRecommendationService {
  constructor(private readonly repository: StyleRecommendationRepository) {}

  async recommend(input: StyleRecommendationInput): Promise<StyleRecommendationResult[]> {
    const styles = await this.repository.listByMode(input.mode);
    const keywords = tokenize(input.user_input);

    const ranked = styles
      .map((style) => {
        const { score, matched } = scoreTags(keywords, style.tags);
        return {
          id: style.id,
          name: style.name,
          score,
          matched_tags: matched,
        };
      })
      .sort((a, b) => b.score - a.score || a.id - b.id)
      .slice(0, 3);

    return ranked;
  }
}
