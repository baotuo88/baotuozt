import type {
  ApiCallLogRecord,
  ErrorLogView,
  LogQueryFilter,
  LogsRepository,
  RequestLogRecord,
  RequestLogView,
  ApiCallLogView,
} from './logs.types';

export class LogsService {
  constructor(private readonly repository: LogsRepository) {}

  async writeRequestLog(record: RequestLogRecord): Promise<void> {
    await this.repository.createRequestLog({
      ...record,
      created_at: record.created_at ?? new Date().toISOString(),
    });
  }

  async writeApiCallLog(record: ApiCallLogRecord): Promise<void> {
    await this.repository.createApiCallLog({
      ...record,
      created_at: record.created_at ?? new Date().toISOString(),
    });
  }

  async getRequestLogs(filter: LogQueryFilter = {}): Promise<RequestLogView[]> {
    return this.repository.queryRequestLogs(filter);
  }

  async getErrorLogs(filter: LogQueryFilter = {}): Promise<ErrorLogView[]> {
    return this.repository.queryErrorLogs(filter);
  }

  async getApiCallLogs(filter: LogQueryFilter = {}): Promise<ApiCallLogView[]> {
    return this.repository.queryApiCallLogs(filter);
  }
}
