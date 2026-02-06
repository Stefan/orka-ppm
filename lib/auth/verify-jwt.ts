/**
 * Server-side JWT verification for API routes.
 * Verifies Supabase JWTs with SUPABASE_JWT_SECRET (must not be exposed to client).
 */

import * as jose from 'jose'

const ALG = 'HS256'

/**
 * Verify Bearer token and return the subject (user id) or null.
 * Use only in server-side code (API routes, getServerSideProps).
 */
export async function getUserIdFromAuthHeader(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  if (!token) return null

  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    // No secret configured: decode only (legacy). Do not use in production.
    try {
      const payload = jose.decodeJwt(token)
      const sub = payload.sub
      return typeof sub === 'string' ? sub : null
    } catch {
      return null
    }
  }

  try {
    const key = new TextEncoder().encode(secret)
    const { payload } = await jose.jwtVerify(token, key, { algorithms: [ALG] })
    const sub = payload.sub
    return typeof sub === 'string' ? sub : null
  } catch {
    return null
  }
}

/**
 * Require valid auth: returns userId or throws Response (401) for NextResponse.json.
 */
export async function requireAuth(authHeader: string | null): Promise<string> {
  const userId = await getUserIdFromAuthHeader(authHeader)
  if (!userId) {
    throw new Response(JSON.stringify({ error: 'Authorization required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return userId
}

/** For sync routes: require auth and optionally enforce request userId matches token. Returns 401/403 NextResponse or { userId }. */
export async function enforceSyncAuth(
  authHeader: string | null,
  requestUserId: string | null
): Promise<{ userId: string } | Response> {
  const userId = await getUserIdFromAuthHeader(authHeader)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authorization required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (requestUserId != null && requestUserId !== userId) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return { userId }
}
