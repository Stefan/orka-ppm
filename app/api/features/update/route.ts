import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const WEBHOOK_SECRET = process.env.FEATURES_WEBHOOK_SECRET ?? ''

/**
 * Webhook for auto-update on Git push.
 * Verifies secret, then can trigger Playwright screenshot job and optional AI scan.
 * Idempotent and safe to call repeatedly.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get('x-webhook-secret') ?? request.headers.get('authorization')?.replace('Bearer ', '')
  if (WEBHOOK_SECRET && auth !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const ref = (body as { ref?: string }).ref ?? ''
    const repo = (body as { repository?: { full_name?: string } }).repository?.full_name ?? ''

    // Optional: trigger Playwright screenshot script (e.g. via spawn or queue)
    // await runFeatureScreenshots()
    // Optional: AI scan of diff to update features table
    // await runAIFeatureScan(repo, ref)

    return NextResponse.json({
      ok: true,
      message: 'Webhook received',
      ref: ref || undefined,
      repo: repo || undefined,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Webhook failed' },
      { status: 500 }
    )
  }
}
