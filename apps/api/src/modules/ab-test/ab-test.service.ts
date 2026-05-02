import type {
  AbTestRepository,
  BestImageResult,
  CreateAbImagesInput,
  GenerateGateway,
} from './ab-test.types';

export class AbTestService {
  constructor(
    private readonly repository: AbTestRepository,
    private readonly generateGateway: GenerateGateway,
  ) {}

  async createThreeImages(input: CreateAbImagesInput): Promise<{ image_ids: number[] }> {
    const variants = [1, 2, 3].map((index) => {
      const normalizedInput = (input.user_input ?? '').trim();
      const variantHint = `[ab_variant:${index}]`;
      return {
        ...input,
        user_input: normalizedInput ? `${normalizedInput} ${variantHint}` : variantHint,
      };
    });

    const tasks = await Promise.all(
      variants.map((variant) => this.generateGateway.generateImageTask(variant)),
    );

    const imageIds = tasks
      .map((x) => x.task_id)
      .filter((x): x is number => typeof x === 'number' && x > 0);

    if (imageIds.length !== 3) {
      throw new Error('AB_TEST_CREATE_FAILED');
    }

    await Promise.all(imageIds.map((id) => this.repository.upsertImage(id)));

    return { image_ids: imageIds };
  }

  async recordClick(imageId: number): Promise<void> {
    if (!Number.isInteger(imageId) || imageId <= 0) {
      throw new Error('INVALID_IMAGE_ID');
    }
    await this.repository.incrementClicks(imageId);
  }

  async pickBestImage(imageIds: number[]): Promise<BestImageResult | null> {
    if (imageIds.length === 0) {
      return null;
    }

    const rows = await this.repository.findByImageIds(imageIds);
    if (rows.length === 0) {
      return null;
    }

    const best = [...rows].sort((a, b) => b.clicks - a.clicks || a.image_id - b.image_id)[0];
    if (!best) {
      return null;
    }
    return {
      image_id: best.image_id,
      clicks: best.clicks,
    };
  }
}
