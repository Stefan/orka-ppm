/**
 * Shared helpers for testing Next.js API Route Handlers.
 * Creates mock NextRequest/Request-like objects for handler invocation.
 */

export type MockRequestInit = {
  method?: string
  url?: string
  headers?: Record<string, string>
  body?: string | object
  cookies?: Array<{ name: string; value: string }>
}

/**
 * Create a minimal mock for NextRequest for use in Jest.
 * NextRequest extends Request; we use Request when possible and extend for cookies.
 */
export function createMockNextRequest(init: MockRequestInit = {}): Request {
  const {
    method = 'GET',
    url = 'http://localhost:3000/api/health',
    headers = {},
    body,
  } = init

  const bodyStr =
    typeof body === 'object' ? JSON.stringify(body) : body

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }

  return new Request(url, {
    method,
    headers: defaultHeaders,
    body: bodyStr,
  })
}

/**
 * Create Request with Authorization Bearer token
 */
export function createAuthenticatedRequest(
  url: string,
  token: string = 'test-token',
  init: Partial<MockRequestInit> = {}
): Request {
  return createMockNextRequest({
    url,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
    ...init,
  })
}

/**
 * Parse JSON from Response (for assertions)
 */
export async function parseJsonResponse(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * Create a Request-like object with cookies for routes that use request.cookies (e.g. projects/import).
 * Use with type assertion to NextRequest when calling route handlers.
 */
export function createMockNextRequestWithCookies(init: MockRequestInit = {}): Request & { cookies: { get: (name: string) => { value: string } | undefined } } {
  const base = createMockNextRequest(init)
  const cookieList = init.cookies || []
  const cookieMap = new Map(cookieList.map((c) => [c.name, c.value]))
  const cookies = {
    get(name: string) {
      const value = cookieMap.get(name)
      return value !== undefined ? { value } : undefined
    },
  }
  return Object.assign(base, { cookies }) as Request & { cookies: { get: (name: string) => { value: string } | undefined } }
}
