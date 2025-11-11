const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000').replace(/\/$/, '');

type RequestOptions = RequestInit & { skipJson?: boolean };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const headers = new Headers(options.headers);

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const { skipJson, ...fetchOptions } = options;
  const response = await fetch(url, { ...fetchOptions, headers });

  if (!response.ok) {
    let message: string;
    try {
      message = await response.text();
    } catch (error) {
      message = error instanceof Error ? error.message : response.statusText;
    }
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  if (skipJson || response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const textPayload = await response.text();
    return (textPayload as unknown) as T;
  }

  return (await response.json()) as T;
}

function withBody(body: unknown | undefined, options?: RequestInit): RequestInit {
  if (body === undefined) {
    return options ?? {};
  }
  return { ...options, body: JSON.stringify(body) };
}

export const apiClient = {
  get<T>(path: string, options: RequestInit = {}): Promise<T> {
    return request<T>(path, { ...options, method: 'GET' });
  },
  post<T>(path: string, body?: unknown, options: RequestInit = {}): Promise<T> {
    return request<T>(path, { ...withBody(body, options), method: 'POST' });
  },
  delete<T>(path: string, options: RequestInit = {}): Promise<T> {
    return request<T>(path, { ...options, method: 'DELETE' });
  }
};
