export interface ApiClientOptions {
  baseUrl: string;
  getToken?: () => string;
  timeoutMs?: number;
}

export class ApiClientError extends Error {
  status: number;
  requestId?: string;
  responseText?: string;

  constructor(input: { message: string; status: number; requestId?: string; responseText?: string }) {
    super(input.message);
    this.status = input.status;
    this.requestId = input.requestId;
    this.responseText = input.responseText;
  }
}

export function createApiClient(options: ApiClientOptions) {
  const timeoutMs = Math.max(1000, options.timeoutMs ?? 15000);

  async function request<T>(path: string, init?: RequestInit): Promise<{ data: T; requestId?: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const token = options.getToken ? options.getToken() : '';
      const resp = await fetch(`${options.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init?.headers || {}),
        },
      });

      const requestId = resp.headers.get('x-request-id') || undefined;
      const text = await resp.text();

      if (!resp.ok) {
        throw new ApiClientError({
          message: `HTTP_${resp.status}`,
          status: resp.status,
          requestId,
          responseText: text,
        });
      }

      const data = (text ? JSON.parse(text) : null) as T;
      return { data, requestId };
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') {
        throw new ApiClientError({
          message: 'REQUEST_TIMEOUT',
          status: 408,
        });
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    get: <T>(path: string) => request<T>(path, { method: 'GET' }),
    post: <T>(path: string, body?: unknown) =>
      request<T>(path, {
        method: 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    patch: <T>(path: string, body?: unknown) =>
      request<T>(path, {
        method: 'PATCH',
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
  };
}
