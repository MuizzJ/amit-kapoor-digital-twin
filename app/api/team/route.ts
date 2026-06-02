import Anthropic from '@anthropic-ai/sdk'
import { Pinecone } from '@pinecone-database/pinecone'
import * as fs from 'fs'
import * as path from 'path'
import { extractEmail, authResponse } from '@/lib/ratelimit'

const MODEL = 'claude-sonnet-4-6'
const INDEX_NAME = (process.env.PINECONE_INDEX_NAME || 'ask-amit').trim()
const NAMESPACE = 'books'
const TOP_K = 10
const MAX_TOKENS = 4000

export const runtime = 'nodejs'
export const maxDuration = 120

const PROMPT_PATH = path.join(process.cwd(), 'prompts', 'team-amit.md')

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'muizz.jivani@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

const TEMPORAL_SIGNALS =
  /\b(current|recent|today|now|latest|recently|news|2025|2026|2027|this year|this month|this week|this quarter|crisis|conflict|war|ceasefire|sanction|tariff|inflation|rate cut|rate hike|gdp|growth forecast|global headwind|geopolit|ukraine|russia|china|taiwan|west asia|middle east|budget|election|reform|policy|ai act|ai regulation|macro|rbi|fed |imf |world bank|forecast)\b/i

function loadTeamPrompt(): string {
  try {
    return fs.readFileSync(PROMPT_PATH, 'utf8')
  } catch {
    return 'You are Ask Amit on the internal team dashboard. Answer in depth, first person as Dr. Amit Kapoor.'
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
        search_depth: 'advanced',
        max_results: 8,
        include_answer: true,
        include_raw_content: false,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const parts: string[] = []
    if (data.answer) parts.push(`Current context: ${data.answer}`)
    for (const r of (data.results ?? []).slice(0, 8)) {
      const snippet = r.content?.slice(0, 600) ?? ''
      if (snippet) parts.push(`[${r.title}] (${r.url})\n${snippet}`)
    }
    return parts.length ? parts.join('\n\n---\n\n') : null
  } catch {
    return null
  }
}

const FORMAT_INSTRUCTIONS: Record<string, string> = {
  article:
    'OUTPUT FORMAT: Write a full publishable article, 600–1500 words. Use clear section headers (##). Op-ed voice — direct, evidence-anchored, opinionated. Thesis in the first paragraph. No bullets in the body. Conclude with a forward-looking stake, not a summary.',
  critique:
    'OUTPUT FORMAT: Write a structured critique. Lead with what works. Then name what is missing, misaligned, or weakest. Be direct and specific. End with 2–3 concrete revision suggestions. First person throughout.',
  analysis:
    'OUTPUT FORMAT: Write a structured analytical memo. Use headers. Apply Amit\'s frameworks explicitly and name them. Include a comparison table if comparing across entities. End with a 3-point "So What" summary.',
  infographic:
    'OUTPUT FORMAT: Output a single self-contained HTML document with inline CSS — a clean, visually compelling infographic. Color palette: dark navy (#0B1929) background, white text, red (#e63946) accents. Include title, 1-line subtitle, core content (cards, flow, or stat blocks), and a source attribution line. Output ONLY the raw HTML with no explanation, no markdown fences, nothing before or after the DOCTYPE.',
  slides:
    'OUTPUT FORMAT: Output a self-contained keyboard-navigable HTML slide deck. Dark navy (#0B1929) background, red (#e63946) accents, white text. 5–8 slides: title → context → framework → data/evidence → recommendation → next steps. Each slide one clear idea. Include JS for arrow-key navigation. Output ONLY the raw HTML with no explanation, no markdown fences, nothing before or after the DOCTYPE.',
  chat: '',
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  try {
    const email = extractEmail(req)
    if (!email) {
      return authResponse()
    }
    if (!ADMIN_EMAILS.includes(email)) {
      return new Response(
        JSON.stringify({
          error: 'team_only',
          message: 'The team dashboard is restricted to authorised team members. Ask Muizz to add your email.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { messages, outputFormat = 'chat' } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response('messages required', { status: 400 })
    }

    const lastUser = [...messages].reverse().find((m: any) => m.role === 'user')
    if (!lastUser?.content) return new Response('no user message', { status: 400 })

    console.log(JSON.stringify({
      route: 'team',
      event: 'accepted',
      email,
      ip,
      outputFormat,
      question: lastUser.content.slice(0, 150),
      ts: new Date().toISOString(),
    }))

    const needsSearch = TEMPORAL_SIGNALS.test(lastUser.content) ||
      outputFormat === 'article' ||
      outputFormat === 'analysis' ||
      outputFormat === 'infographic'

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
      console.log(JSON.stringify({ route: 'team', event: 'web_search', email, ts: new Date().toISOString() }))
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim() })

    const formatInstruction = FORMAT_INSTRUCTIONS[outputFormat] ?? ''

    const systemBlocks: any[] = [
      {
        type: 'text',
        text: loadTeamPrompt() + (formatInstruction ? `\n\n---\n\n${formatInstruction}` : ''),
      },
      ...(webContext
        ? [
            {
              type: 'text',
              text: `The following are live web search results reflecting the current state of the world. Synthesise these with your indexed knowledge to produce an output grounded in both your analytical frameworks and current events. Do not cite URLs inline — weave the context into the analysis as your own contextual awareness.\n\n${webContext}`,
            },
          ]
        : []),
      {
        type: 'text',
        text: `The following are verbatim passages from your own published works. They are evidence, not a script. Synthesise the ideas in fresh language. Keep frameworks, numbers, and dates intact; rewrite everything else. Do not cite passage numbers or chunk indices. You may reference works by name in first person — "in The Elephant Moves," "in my Financial Express essay."\n\n${contextBlock}`,
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
            `data: ${JSON.stringify({ type: 'sources', sources, webSearched: !!webContext, outputFormat })}\n\n`
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
    console.error('Team route error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
