import Anthropic from '@anthropic-ai/sdk'
import { Pinecone } from '@pinecone-database/pinecone'
import * as fs from 'fs'
import * as path from 'path'
import {
  checkLimit,
  extractEmail,
  limitResponse,
  authResponse,
} from '@/lib/ratelimit'

const MODEL = 'claude-sonnet-4-6'
const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'ask-amit'
const NAMESPACE = 'books'
const TOP_K = 6
const MAX_TOKENS = 600

export const runtime = 'nodejs'
export const maxDuration = 60

const PROMPT_PATH = path.join(process.cwd(), 'prompts', 'ask-amit.md')

function loadSystemPrompt(): string {
  try {
    return fs.readFileSync(PROMPT_PATH, 'utf8')
  } catch {
    return 'You are Ask Amit. Answer only from the retrieved passages.'
  }
}

export async function POST(req: Request) {
  const startedAt = Date.now()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  try {
    const email = extractEmail(req)
    if (!email) {
      console.log(JSON.stringify({ route: 'rag', event: 'blocked_unauth', ip, ts: new Date().toISOString() }))
      return authResponse()
    }

    const limit = checkLimit(email, 'rag')
    if (!limit.ok) {
      console.log(JSON.stringify({ route: 'rag', event: 'blocked_limit', email, reason: limit.reason, ip, ts: new Date().toISOString() }))
      return limitResponse(limit)
    }

    const { messages } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response('messages required', { status: 400 })
    }

    const question = [...messages].reverse().find((m: any) => m.role === 'user')?.content?.slice(0, 200) || ''
    console.log(JSON.stringify({ route: 'rag', event: 'accepted', email, ip, question, ts: new Date().toISOString() }))

    const lastUser = [...messages].reverse().find((m: any) => m.role === 'user')
    if (!lastUser?.content) return new Response('no user message', { status: 400 })

    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
    const index = pc.index(INDEX_NAME).namespace(NAMESPACE)

    const search = await index.searchRecords({
      query: { topK: TOP_K, inputs: { text: lastUser.content } },
      fields: ['chunk_text', 'title', 'chunk_index', 'source'],
    })

    const hits = search.result.hits as any[]
    const contextBlock = hits
      .map(
        (h, i) =>
          `[${i + 1}] ${h.fields.title}, chunk ${h.fields.chunk_index}\n${h.fields.chunk_text}`
      )
      .join('\n\n---\n\n')

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const systemBlocks: any[] = [
      { type: 'text', text: loadSystemPrompt() },
      {
        type: 'text',
        text: `Retrieved passages (for your reference only; do not cite, reference, or mention these in your reply):\n\n${contextBlock}`,
        cache_control: { type: 'ephemeral' },
      },
    ]

    const cleanMessages = messages
      .filter((m: any) => m.role === 'user' || m.role === 'assistant')
      .map((m: any) => ({ role: m.role, content: m.content }))

    const stream = await anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemBlocks,
      messages: cleanMessages,
    })

    const encoder = new TextEncoder()
    const sources = hits.map((h) => ({
      title: h.fields.title,
      chunk_index: h.fields.chunk_index,
      score: h._score,
    }))

    const readable = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`)
        )
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'text', text: chunk.delta.text })}\n\n`
                )
              )
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
        } catch (err: any) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`
            )
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (err: any) {
    console.error('RAG route error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
