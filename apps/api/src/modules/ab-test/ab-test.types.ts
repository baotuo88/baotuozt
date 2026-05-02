import type { GenerateMode } from '../style-system';

export interface AbTestRow {
  image_id: number;
  clicks: number;
}

export interface AbTestRepository {
  upsertImage(imageId: number): Promise<void>;
  incrementClicks(imageId: number): Promise<void>;
  findByImageIds(imageIds: number[]): Promise<AbTestRow[]>;
}

export interface GenerateGateway {
  generateImageTask(input: {
    user_id: number;
    mode: GenerateMode;
    style_id: number;
    image_url?: string | null;
    user_input?: string | null;
  }): Promise<{ task_id: number | null; result_url?: string; from_cache: boolean }>;
}

export interface CreateAbImagesInput {
  user_id: number;
  mode: 'ecommerce' | 'social' | 'portrait' | 'general';
  style_id: number;
  image_url?: string | null;
  user_input?: string | null;
}

export interface BestImageResult {
  image_id: number;
  clicks: number;
}
