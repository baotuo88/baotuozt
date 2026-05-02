import type { ErrorLogRecord, ErrorLogsRepository } from './error-logs.types';

export class ErrorLogsService {
  constructor(private readonly repository: ErrorLogsRepository) {}

  async write(record: ErrorLogRecord): Promise<void> {
    await this.repository.create({
      ...record,
      created_at: record.created_at ?? new Date().toISOString(),
    });
  }
}
