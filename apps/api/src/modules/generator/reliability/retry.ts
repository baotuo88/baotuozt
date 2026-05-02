export interface RetryOptions {
  attempts: number;
  delayMs: number;
  backoff?: 'fixed' | 'exponential';
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const shouldRetry = options.shouldRetry ? options.shouldRetry(error, attempt) : true;
      if (!shouldRetry || attempt >= options.attempts) {
        break;
      }

      const factor = options.backoff === 'exponential' ? 2 ** (attempt - 1) : 1;
      await sleep(options.delayMs * factor);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('RETRY_FAILED');
}
