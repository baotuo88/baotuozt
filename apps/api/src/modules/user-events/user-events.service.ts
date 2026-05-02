import type {
  UserEventRecord,
  UserEventsQuery,
  UserEventsRepository,
} from './user-events.types';

export class UserEventsService {
  constructor(private readonly repository: UserEventsRepository) {}

  async track(event: UserEventRecord): Promise<void> {
    await this.repository.create({
      ...event,
      created_at: event.created_at ?? new Date().toISOString(),
    });
  }

  async getConversionSummary(query: UserEventsQuery = {}): Promise<{
    click_generate: number;
    download_image: number;
    conversion_rate: number;
  }> {
    const [clickGenerate, downloadImage] = await Promise.all([
      this.repository.countByType('click_generate', query),
      this.repository.countByType('download_image', query),
    ]);

    const conversionRate = clickGenerate > 0 ? downloadImage / clickGenerate : 0;

    return {
      click_generate: clickGenerate,
      download_image: downloadImage,
      conversion_rate: Number(conversionRate.toFixed(4)),
    };
  }
}
