/**
 * The API client of the page (spec-004 §3, §5): same-origin requests under `/api/` only, the
 * session cookie sent by the browser, JSON bodies. An error answer is thrown as an {@link ApiError}
 * built from the envelope `{ error: { code, message, detail? } }`; a 401 also loses the session.
 * Read answers carry the repository state (`X-Repo-State`, `<HEAD>.<status hash>`).
 */
import { markSessionLost } from '../session/session.js';

/** Header of the repository state on read answers. */
export const REPO_STATE_HEADER = 'X-Repo-State';

/** An error answer of the API (spec-004 §5). */
export class ApiError extends Error {
  constructor(
    /** HTTP status. */
    readonly status: number,
    /** Error code of the envelope (`internal` when the body is not an envelope). */
    readonly code: string,
    message: string,
    /** The envelope's `detail`: the arguments of the catalogue message (spec-008 §4). */
    readonly detail: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** A successful answer. */
export interface ApiResult<T> {
  data: T;
  status: number;
  /** `X-Repo-State`, or `null` when the answer has none. */
  repoState: string | null;
}

/** HTTP methods of the API. */
export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

function envelope(body: unknown): { code: string; message: string; detail?: unknown } | undefined {
  const error = (body as { error?: unknown } | null)?.error as
    { code?: unknown; message?: unknown; detail?: unknown } | undefined;
  if (typeof error?.code !== 'string' || typeof error.message !== 'string') return undefined;
  return { code: error.code, message: error.message, detail: error.detail };
}

/** Send one request to the API (`path` must start with `/api/`). */
export async function apiRequest<T>(
  method: ApiMethod,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<ApiResult<T>> {
  if (!path.startsWith('/api/')) throw new Error(`not a same-origin API path: ${path}`);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(signal ? { signal } : {}),
  });
  const text = response.status === 204 ? '' : await response.text();
  let parsed: unknown;
  try {
    parsed = text === '' ? undefined : JSON.parse(text);
  } catch {
    // Not JSON (e.g. a proxy's HTML page): an error answer becomes `internal` below.
  }
  if (!response.ok) {
    if (response.status === 401) markSessionLost();
    const e = envelope(parsed);
    throw new ApiError(response.status, e?.code ?? 'internal', e?.message ?? response.statusText, e?.detail);
  }
  return { data: parsed as T, status: response.status, repoState: response.headers.get(REPO_STATE_HEADER) };
}

/** GET `path` and return its body (the query functions' form). */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return (await apiRequest<T>('GET', path, undefined, signal)).data;
}
