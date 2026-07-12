import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import {
  checkLimit,
  extractEmail,
  limitResponse,
  authResponse,
} from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const maxDuration = 30

const DEFAULT_VOICE = (process.env.ELEVENLABS_VOICE_ID || '').trim()
const MODEL_ID = 'eleven_turbo_v2_5'
const MAX_CHARS = 1200

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  try {
    const email = extractEmail(req)
    if (!email) {
      console.log(JSON.stringify({ route: 'tts', event: 'blocked_unauth', ip, ts: new Date().toISOString() }))
      return authResponse()
    }

    const limit = checkLimit(email, 'tts')
    if (!limit.ok) {
      console.log(JSON.stringify({ route: 'tts', event: 'blocked_limit', email, reason: limit.reason, ip, ts: new Date().toISOString() }))
      return limitResponse(limit)
    }

    const { text } = await req.json()
    console.log(JSON.stringify({ route: 'tts', event: 'accepted', email, ip, chars: text?.length || 0, ts: new Date().toISOString() }))
    if (!text || typeof text !== 'string') {
      return new Response('text required', { status: 400 })
    }

    const trimmed = text.slice(0, MAX_CHARS).trim()
    if (!trimmed) return new Response('empty text', { status: 400 })

    if (!DEFAULT_VOICE) {
      return new Response(
        JSON.stringify({ error: 'ELEVENLABS_VOICE_ID is not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY!.trim() })

    const audioStream = await client.textToSpeech.stream(DEFAULT_VOICE, {
      text: trimmed,
      modelId: MODEL_ID,
      outputFormat: 'mp3_44100_128',
    })

    const reader = (audioStream as any).getReader
      ? (audioStream as any).getReader()
      : null

    const webStream = reader
      ? new ReadableStream({
          async pull(controller) {
            const { done, value } = await reader.read()
            if (done) controller.close()
            else controller.enqueue(value)
          },
        })
      : (audioStream as any)

    return new Response(webStream, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err: any) {
    console.error('TTS error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
