export class ApiResponseError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiResponseError';
  }
}
/** Read one API object without leaking HTML, stack traces or raw JSON parser errors to the UI. */
export async function readApiResponse<T = Record<string, any>>(
  response: Response,
  audience: 'admin' | 'public' = 'admin',
): Promise<T> {
  const text = await response.text();
  let body: unknown;
  try {
    body = text.trim() ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  const object =
    body !== null && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  const jsonType = (response.headers.get('content-type') || '').toLowerCase().includes('json');
  if (!response.ok) {
    if (jsonType && typeof object?.error === 'string' && object.error.trim())
      throw new ApiResponseError(object.error.slice(0, 500), response.status);
    throw new ApiResponseError(
      audience === 'public'
        ? 'This page is temporarily unavailable. Please try again shortly.'
        : 'The server could not complete the request (HTTP ' +
            response.status +
            '). Check the server terminal for the underlying error, then try again.',
      response.status,
    );
  }
  if (!jsonType || !object)
    throw new ApiResponseError(
      audience === 'public'
        ? 'This page is temporarily unavailable. Please try again shortly.'
        : 'The server returned an empty or unexpected response (HTTP ' +
            response.status +
            '). Check the server terminal and restart the local server if necessary.',
      response.status,
    );
  return object as T;
}
