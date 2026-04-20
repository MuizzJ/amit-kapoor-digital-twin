const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'muizz.jivani@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

const ALLOWED_EMAILS = [
  ...ADMIN_EMAILS,
  ...(
    process.env.ALLOWED_EMAILS || 'amit.kapoor@competitiveness.in'
  )
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
]

function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email)
}

export function extractEmail(req: Request): string | null {
  const raw = req.headers.get('x-user-email')?.trim().toLowerCase()
  if (!raw) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null
  if (!ALLOWED_EMAILS.includes(raw)) return null
  return raw
}

type Bucket = { count: number; reset: number }
type UserBuckets = { rag: Bucket; tts: Bucket }

const WINDOW_MS = 24 * 3600_000
const RAG_MAX_PER_USER = 3
const TTS_MAX_PER_USER = 5
const GLOBAL_RAG_MAX = 60
const GLOBAL_TTS_MAX = 120

const users = new Map<string, UserBuckets>()
let globalRag: Bucket = { count: 0, reset: Date.now() + WINDOW_MS }
let globalTts: Bucket = { count: 0, reset: Date.now() + WINDOW_MS }

function fresh(): Bucket {
  return { count: 0, reset: Date.now() + WINDOW_MS }
}

export type LimitResult =
  | { ok: true }
  | { ok: false; reason: 'user' | 'global'; retryAfter: number }

export function checkLimit(email: string, kind: 'rag' | 'tts'): LimitResult {
  if (isAdmin(email)) return { ok: true }

  const t = Date.now()
  const g = kind === 'rag' ? globalRag : globalTts
  const gMax = kind === 'rag' ? GLOBAL_RAG_MAX : GLOBAL_TTS_MAX
  const uMax = kind === 'rag' ? RAG_MAX_PER_USER : TTS_MAX_PER_USER

  if (t > g.reset) {
    g.count = 0
    g.reset = t + WINDOW_MS
  }

  let u = users.get(email)
  if (!u) {
    u = { rag: fresh(), tts: fresh() }
    users.set(email, u)
  }
  const b = u[kind]
  if (t > b.reset) {
    b.count = 0
    b.reset = t + WINDOW_MS
  }

  if (g.count >= gMax) {
    return { ok: false, reason: 'global', retryAfter: Math.ceil((g.reset - t) / 1000) }
  }
  if (b.count >= uMax) {
    return { ok: false, reason: 'user', retryAfter: Math.ceil((b.reset - t) / 1000) }
  }

  b.count++
  g.count++
  return { ok: true }
}

export function limitResponse(result: Extract<LimitResult, { ok: false }>): Response {
  const hours = Math.max(1, Math.ceil(result.retryAfter / 3600))
  const msg =
    result.reason === 'user'
      ? `You've reached the preview cap for today. Try again in ~${hours}h.`
      : `Preview is at capacity right now. Try again in ~${hours}h.`
  return new Response(
    JSON.stringify({ error: 'rate_limit', message: msg, reason: result.reason }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfter),
      },
    }
  )
}

export function authResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'not_allowed',
      message:
        'This preview is restricted. Enter the email the link was sent to.',
    }),
    {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}
