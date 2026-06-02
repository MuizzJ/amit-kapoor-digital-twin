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
const INDEX_NAME = (process.env.PINECONE_INDEX_NAME || 'ask-amit').trim()
const NAMESPACE = 'books'
const TOP_K = 8
const MAX_TOKENS = 800

export const runtime = 'nodejs'
export const maxDuration = 90

const PROMPT_PATH = path.join(process.cwd(), 'prompts', 'ask-amit.md')

// Triggers that suggest the question needs live web context
const TEMPORAL_SIGNALS =
  /\b(current|recent|today|now|latest|recently|news|2025|2026|2027|this year|this month|this week|this quarter|crisis|conflict|war|ceasefire|sanction|tariff|inflation|rate cut|rate hike|gdp|growth forecast|global headwind|geopolit|ukraine|russia|china|taiwan|west asia|middle east|budget|election|reform|policy|ai act|ai regulation|macro|rbi|fed |imf |world bank|forecast)\b/i

function loadSystemPrompt(): string {
  try {
    return fs.readFileSync(PROMPT_PATH, 'utf8')
  } catch {
    return 'You are Ask Amit. Answer only from the retrieved passages.'
  }
}

async function searchWeb(query: string): Promise<string | null> {
  const apiKey = process.env.TAVILY_API_KEY?.trim()
  if (!apiKey) return null
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true,
        include_raw_content: false,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const parts: string[] = []
    if (data.answer) parts.push(`Current context: ${data.answer}`)
    for (const r of (data.results ?? []).slice(0, 5)) {
      const snippet = r.content?.slice(0, 400) ?? ''
      if (snippet) parts.push(`[${r.title}]\n${snippet}`)
    }
    return parts.length ? parts.join('\n\n---\n\n') : null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
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

    const lastUser = [...messages].reverse().find((m: any) => m.role === 'user')
    if (!lastUser?.content) return new Response('no user message', { status: 400 })

    const question = lastUser.content.slice(0, 200)
    console.log(JSON.stringify({ route: 'rag', event: 'accepted', email, ip, question, ts: new Date().toISOString() }))

    // Run Pinecone retrieval and web search concurrently when signals match
    const needsSearch = TEMPORAL_SIGNALS.test(lastUser.content)

    const [pineconeResult, webContext] = await Promise.all([
      (() => {
        const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY!.trim() })
        return pc.index(INDEX_NAME).namespace(NAMESPACE).searchRecords({
          query: { topK: TOP_K, inputs: { text: lastUser.content } },
          fields: ['chunk_text', 'title', 'chunk_index', 'source'],
        })
      })(),
      needsSearch ? searchWeb(lastUser.content) : Promise.resolve(null),
    ])

    const hits = pineconeResult.result.hits as any[]
    const contextBlock = hits
      .map((h, i) => `[${i + 1}] ${h.fields.title}, chunk ${h.fields.chunk_index}\n${h.fields.chunk_text}`)
      .join('\n\n---\n\n')

    if (webContext) {
      console.log(JSON.stringify({ route: 'rag', event: 'web_search', email, query: lastUser.content.slice(0, 100), ts: new Date().toISOString() }))
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim() })

    const systemBlocks: any[] = [
      { type: 'text', text: loadSystemPrompt() },
      ...(webContext
        ? [
            {
              type: 'text',
              text: `The following are live web search results reflecting the current state of the world as of today. Use them to ground your analytical frameworks in what is actually happening now. Do not cite URLs, source names, or mention "according to search results" — synthesize this as your own contextual awareness. Limit yourself to one sentence of contemporary grounding drawn from this; your full analytical argument must still come from your published work.\n\n${webContext}`,
            },
          ]
        : []),
      {
        type: 'text',
        text: `The following are verbatim passages from your own published works. They are evidence, not a script. Do not echo their wording, sentence rhythm, or paragraph structure. Rephrase the ideas in fresh, direct prose. Keep named frameworks, numbers, and dates intact; rewrite everything else. Do not cite passage numbers, chunk indices, or use bracket references. You may naturally reference the work by name in first person — "in The Elephant Moves," "in my Financial Express essay," "in my Stanford keynote" — when the idea traces directly to it.\n\n${contextBlock}`,
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
          encoder.encode(
            `data: ${JSON.stringify({ type: 'sources', sources, webSearched: !!webContext })}\n\n`
          )
        )
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'text', text: chunk.delta.text })}\n\n`)
              )
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
        } catch (err: any) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`)
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
