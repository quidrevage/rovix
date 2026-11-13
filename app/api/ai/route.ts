import { NextResponse } from 'next/server'
import { aiConfigured, chatFromAI, foodFromAI, guideFromAI, planFromAI, recipeFromAI, shoppingFromAI, translatePlanWithAI } from '@/lib/aiServer'

// The only place the browser can reach Gemini through. The key stays on the server;
// the browser sends what it wants done (plan / chat / guide) and the prompts are built here.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Plan generation is slow; hosts with a lower limit will cut it off and the app falls back to the demo plan.
export const maxDuration = 300

// Room for one food photo, which the browser shrinks before sending.
const MAX_BODY_CHARS = 500_000
const LOCALES = ['en', 'uk', 'ru']

const fail = (error: string, status: number) => NextResponse.json({ error }, { status })

// A simple per-address limit so one visitor cannot burn the whole Gemini quota.
// It lives in memory: enough for a single server, not shared between serverless instances.
const WINDOW_MS = 60_000
const MAX_REQUESTS = 20
const hits = new Map<string, { count: number; resetAt: number }>()

function overLimit(request: Request): boolean {
  const address = (request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim()
  const now = Date.now()
  const entry = hits.get(address)
  if (!entry || entry.resetAt < now) {
    if (hits.size > 5000) hits.clear()
    hits.set(address, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  return ++entry.count > MAX_REQUESTS
}

/** Lets the UI know whether AI features are available, without revealing anything about the key. */
export function GET() {
  return NextResponse.json({ configured: aiConfigured })
}

export async function POST(request: Request) {
  // Browsers send Origin on cross-site requests: refuse other sites spending this app's quota.
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (origin && host) {
    let originHost = ''
    try {
      originHost = new URL(origin).host
    } catch {
      // "null" or malformed origin: treated as foreign below.
    }
    if (originHost !== host) return fail('forbidden', 403)
  }

  if (!aiConfigured) return fail('not_configured', 501)
  if (overLimit(request)) return fail('rate_limited', 429)

  let body: any
  try {
    const raw = await request.text()
    if (raw.length > MAX_BODY_CHARS) return fail('too_large', 413)
    body = JSON.parse(raw)
  } catch {
    return fail('bad_request', 400)
  }
  if (!body || typeof body !== 'object') return fail('bad_request', 400)
  const locale = LOCALES.includes(body.locale) ? body.locale : 'en'

  try {
    switch (body.action) {
      case 'plan':
        if (!body.userData || typeof body.userData !== 'object') return fail('bad_request', 400)
        return NextResponse.json({ plan: await planFromAI(body.userData, locale, body.previous) })

      case 'chat': {
        if (typeof body.message !== 'string' || !body.message.trim()) return fail('bad_request', 400)
        const result = await chatFromAI({ message: body.message, history: body.history, userData: body.userData, locale })
        return result ? NextResponse.json(result) : fail('ai_failed', 502)
      }

      case 'guide': {
        if (typeof body.name !== 'string' || !body.name.trim()) return fail('bad_request', 400)
        const guide = await guideFromAI(body.name, locale)
        return guide ? NextResponse.json({ guide }) : fail('ai_failed', 502)
      }

      case 'food': {
        const photo = typeof body.image === 'string' ? /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body.image) : null
        if (!photo && (typeof body.text !== 'string' || !body.text.trim())) return fail('bad_request', 400)
        const food = await foodFromAI(photo ? '' : body.text, locale, photo ? { mimeType: photo[1], data: photo[2] } : undefined)
        return food ? NextResponse.json({ food }) : fail('ai_failed', 502)
      }

      case 'recipe': {
        if (typeof body.dish !== 'string' || !body.dish.trim()) return fail('bad_request', 400)
        const recipe = await recipeFromAI(body.dish, locale)
        return recipe ? NextResponse.json({ recipe }) : fail('ai_failed', 502)
      }

      case 'translate':
        if (!body.plan || typeof body.plan !== 'object') return fail('bad_request', 400)
        return NextResponse.json({ plan: await translatePlanWithAI(body.plan, locale) })

      case 'shopping': {
        const categories = await shoppingFromAI(body.meals, locale)
        return categories ? NextResponse.json({ categories }) : fail('ai_failed', 502)
      }

      default:
        return fail('bad_request', 400)
    }
  } catch (error) {
    console.error(`AI request "${body.action}" failed:`, error)
    return fail('ai_failed', 502)
  }
}
