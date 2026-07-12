# Ask Amit, End-to-End Architecture

## 1. Executive summary

Ask Amit is a retrieval-augmented chatbot that answers questions in the voice of Dr. Amit Kapoor, grounded strictly in his own published work. Phase 1, the scope of this document, is a Next.js 14 site with a floating chat widget that streams answers from Claude Sonnet 4.6, using Pinecone (with integrated `llama-text-embed-v2` embeddings) as the knowledge vault. Three source documents have been ingested into 429 chunks. The backend is a single streaming API route that pulls the top 6 passages, injects them into a cached system prompt, and forwards Claude's token stream to the browser as Server-Sent Events. Phase 2 (ElevenLabs voice playback) and Phase 3 (telephony via Twilio or Vapi) plug into the same retrieval core without changing it. Everything shipping in Phase 1 is ready for Vercel deployment and costs roughly two cents per question, dropping to one-fifth of that on cache hits.

---

## 2. The full pipeline, at a glance

```
  SOURCE FILES (/data)            INGEST (one-time, local)
  ┌──────────────────┐            ┌────────────────────────┐
  │ Age of Awakening │            │ scripts/ingest.ts      │
  │ Elephant Moves   │ ─────────► │  parse (PDF/PPTX/MD)   │ ─┐
  │ Riding the Tiger │            │  chunk (700w / 100w)   │  │
  └──────────────────┘            │  upsert batched 50     │  │
                                  └────────────────────────┘  │
                                                              ▼
                                             ┌──────────────────────────┐
                                             │ PINECONE  ask-amit       │
                                             │  namespace: books        │
                                             │  llama-text-embed-v2     │
                                             │  429 records + metadata  │
                                             └──────────────────────────┘
                                                              ▲
  USER (browser)                   NEXT.JS EDGE/NODE          │
  ┌──────────────────┐             ┌────────────────────────┐ │
  │ VoiceWidget.tsx  │  POST /api  │ app/api/rag/route.ts   │ │
  │  types question  │  /rag       │  1. search top 6       │◄┘
  │  renders stream  │ ─────────►  │  2. load prompt        │
  │  source chips    │             │  3. Claude stream      │
  │                  │ ◄─SSE───────│  4. forward SSE        │
  └──────────────────┘             └──────────┬─────────────┘
                                              │
                                              ▼
                                  ┌──────────────────────────┐
                                  │ ANTHROPIC                │
                                  │  claude-sonnet-4-6       │
                                  │  system = prompt + ctx   │
                                  │  cache_control: ephemeral│
                                  └──────────────────────────┘
```

---

## 3. Component-by-component walkthrough

### 3.1 Source files

**What it is.** Three raw documents in `C:\Users\muizz\Desktop\amit\data\`. These are the only things Ask Amit knows. If a fact is not in these files, the bot is instructed to refuse.

**Files and sizes.**

| File | Size | Format |
| --- | --- | --- |
| `The_Age_of_Awakening_Final.pdf` | 4.3 MB | PDF |
| `The Elephant Moves_Royal_Final.pdf` | 9.1 MB | PDF |
| `Riding_The_Tiger.pptx` | 2.1 MB | PowerPoint |
| `Riding_The_Tiger.md` | 3.3 MB | Markdown (rejected, see below) |

### 3.2 Ingestion pipeline

**File.** `scripts/ingest.ts`. Run with `npx tsx scripts/ingest.ts`.

**What it does.** Walks `/data`, parses every supported file into plain text, splits the text into overlapping word-level chunks, attaches metadata, and pushes the result to Pinecone. Pinecone's integrated inference handles embedding server-side, so there is no separate OpenAI or Voyage embedding call.

**Key numbers.**

- Chunk size: `CHUNK_WORDS = 700`
- Chunk overlap: `OVERLAP_WORDS = 100` (so each new chunk advances 600 words and rereads the prior 100, preserving context across boundaries)
- Minimum chunk length: 50 characters (tiny fragments are dropped)
- Batch size: `BATCH_SIZE = 50` records per upsert call
- Batch delay: `BATCH_DELAY_MS = 15000` (15 seconds of sleep between batches to stay under the 250k embedding-tokens-per-minute free tier)
- Index: `ask-amit`, namespace `books`, embedding model `llama-text-embed-v2` at 1024 dimensions, cosine metric

**Parsers.**

- **PDF** uses the `pdf-parse` package via its `PDFParse` class: `new PDFParse({ data: buffer }).getText()`, then `parser.destroy()` to free memory. The two books come through cleanly.
- **PPTX** uses `adm-zip`. A `.pptx` is actually a zip of XML. The code lists entries matching `ppt/slides/slideN.xml`, sorts them numerically, and scrapes the `<a:t>...</a:t>` runs with a regex. This is how 6 chunks were recovered from the deck.
- **Markdown / TXT** is read straight from disk. The `Riding_The_Tiger.md` file turned out to be almost entirely base64-embedded images, so after `cleanMarkdown()` stripped them there were zero usable characters. It was dropped silently. The `.pptx` version is the usable source for that title.

**Chunker.** `chunkText()` lowercases nothing, normalizes whitespace, splits on spaces, then slides a 700-word window forward in steps of 600 words. Each chunk that exceeds 50 characters is kept.

**Metadata on each record.** `{ _id, chunk_text, source, title, chunk_index, excerpt }`. Titles are mapped from filenames via a `TITLE_MAP` dictionary so the UI sees clean names like "The Age of Awakening" rather than file paths.

**Rate-limit retry loop.** Every upsert batch is wrapped in a `while (true)` that catches 429 / RESOURCE_EXHAUSTED errors, backs off with `30s * attempt`, and retries up to 5 times. Combined with the 15s inter-batch sleep, this keeps the Pinecone free tier happy.

**Chunk count output.**

| Title | Chunks |
| --- | --- |
| The Age of Awakening | 192 |
| The Elephant Moves | 231 |
| Riding the Tiger (PPTX) | 6 |
| **Total** | **429** |

### 3.3 Retrieval validation

**File.** `scripts/query-test.ts`.

**What it does.** Runs 5 canned questions ("What drives India's competitiveness?", "How does Porter's Diamond framework apply to India?", etc.), calls `index.searchRecords` with `topK: 3`, and prints score, title, chunk index, and a 200-character preview for each hit. This is the sanity check before wiring the frontend: if this script returns obviously wrong passages, go back and retune chunk size before touching the API.

### 3.4 Streaming RAG API

**File.** `app/api/rag/route.ts`. POST handler at `/api/rag`.

**What it does.** Accepts `{ messages: [{role, content}, ...] }`, finds the latest user message, queries Pinecone for the top 6 relevant chunks, builds a two-block system prompt (persona + retrieved context), and opens a Claude stream. Every text delta is reformatted as a Server-Sent Event and piped back to the browser.

**Key numbers and config.**

- Model: `claude-sonnet-4-6`
- `TOP_K = 6`
- `MAX_TOKENS = 600`
- `runtime = 'nodejs'`, `maxDuration = 60` seconds (required for streaming on Vercel)
- Namespace: `books`

**SSE stream format.** Three event types, all newline-delimited:

```
data: {"type":"sources","sources":[{"title":"...","chunk_index":12,"score":0.81}, ...]}

data: {"type":"text","text":"India's competitiveness"}

data: {"type":"text","text":" rests on three pillars..."}

data: {"type":"done"}
```

The `sources` event fires first so the widget can render chips the moment streaming starts. Errors emit `{"type":"error","error":"..."}` instead of `done`.

**Prompt caching with `cache_control: ephemeral`.** The system array has two blocks. The first is the voice-and-rules prompt loaded from `prompts/ask-amit.md`. The second is the retrieved context concatenated as numbered passages, and this block carries `cache_control: { type: 'ephemeral' }`. When the same context is reused within Anthropic's cache window (roughly 5 minutes), that block is billed at the cache-read rate (about one-tenth of input), which dominates the per-question cost math below.

**Prompt loading at request time.** `loadSystemPrompt()` reads `prompts/ask-amit.md` from disk on every POST. In dev, editing the file and hitting send is enough: no rebuild, no server restart. In production on Vercel the file is bundled at build time, so tuning the voice requires a redeploy.

### 3.5 Chat widget

**File.** `components/VoiceWidget.tsx`. The component actually exports two widgets: `AskAmitWidget` (bottom-left, the real thing) and `ExploreWidget` (bottom-right, a static topic list placeholder).

**What it does.** Maintains `messages` state as `{role, text, sources?}`. On send it POSTs the whole conversation to `/api/rag`, reads the response body as a `ReadableStream`, and parses SSE lines out of a rolling buffer split on `\n\n`.

**Streaming accumulation.** For every `{type: 'text'}` event the widget finds the last assistant message and appends `evt.text` to it. React re-renders on each append, which is what produces the typewriter effect. A `streaming` flag disables the input and swaps the button into its thinking state while tokens arrive.

**Source chip rendering.** When the `{type: 'sources'}` event lands, the sources array is attached to the current assistant message. The render loop shows up to 4 chips underneath the message bubble: `<Title> · #<chunk_index>`, styled as small red pills. This is the user-visible proof that the answer came from actual books rather than the model's imagination.

**Error handling.** Stream errors or non-OK responses replace the blank assistant bubble with `"Sorry — something went wrong: <message>"`. Malformed JSON lines inside the stream are swallowed silently rather than crashing the widget.

### 3.6 System prompt

**File.** `prompts/ask-amit.md`. Covered in depth in Section 6.

### 3.7 Environment and deps

`.env.local` holds five keys (names only here): `ANTHROPIC_API_KEY`, `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`. The last two are staged for Phase 2 and are not read by the Phase 1 code.

`package.json` dependencies of note: `@anthropic-ai/sdk ^0.90.0`, `@pinecone-database/pinecone ^7.2.0`, `pdf-parse ^2.4.5`, `adm-zip ^0.5.17`, `next ^14.2.5`, `react ^18.3.0`, `tailwindcss ^3.4.1`, `tsx ^4.21.0`.

---

## 4. Data flow for a single user question

```
  Browser                 /api/rag             Pinecone            Anthropic
     │                       │                    │                    │
     │ user hits Enter       │                    │                    │
     │──── POST messages ───►│                    │                    │
     │                       │                    │                    │
     │                       │─ searchRecords ───►│                    │
     │                       │    topK=6          │                    │
     │                       │◄── 6 chunks  ──────│   (300-500 ms)     │
     │                       │                    │                    │
     │                       │─ load prompt.md    │                    │
     │                       │  (disk, <5 ms)     │                    │
     │                       │                    │                    │
     │                       │── messages.stream ───────────────────► │
     │                       │  system=[prompt, cached ctx]            │
     │                       │                                         │
     │                       │◄─ first token ─────────────────────────│
     │◄── sources event ─────│                   (500 ms - 1 s to     │
     │◄── text delta ────────│                    first token)        │
     │◄── text delta ────────│                                         │
     │  (chips appear,       │◄─ text delta ─────────────────────────│
     │   tokens typewriter)  │◄─ text delta ─────────────────────────│
     │◄── text delta ────────│                                         │
     │                       │◄─ message_stop ───────────────────────│
     │◄── done event ────────│                                         │
     │                       │                                         │
     │ done. Total wall time ≈ 1.5 to 3.5 seconds for a 4-sentence answer
```

---

## 5. The knowledge base

**Current contents.** Three documents occupying 15.5 MB on disk, producing 429 indexed chunks:

| File | Size | Chunks | Notes |
| --- | --- | --- | --- |
| `The_Age_of_Awakening_Final.pdf` | 4.3 MB | 192 | clean PDF extract |
| `The Elephant Moves_Royal_Final.pdf` | 9.1 MB | 231 | clean PDF extract |
| `Riding_The_Tiger.pptx` | 2.1 MB | 6 | slide text only, no speaker notes |
| `Riding_The_Tiger.md` | 3.3 MB | 0 | all embedded base64 images, 0 usable chars after stripping |

**How to add a new source.**

1. Drop the file into `data/`. Supported extensions: `.pdf`, `.pptx`, `.md`, `.txt`. If the filename should render with a friendlier label, add an entry to `TITLE_MAP` in `scripts/ingest.ts`.
2. Run `npx tsx scripts/ingest.ts`. This is additive: existing records keep their IDs (`<slug>_<index>`), so a re-ingest overwrites only the chunks from files that were re-parsed. To start fresh, drop the Pinecone index from the dashboard and rerun.
3. Add a bullet to the "Indexed sources" list in `prompts/ask-amit.md` so the bot knows the new material exists and is allowed to draw from it.
4. Ship the prompt change. In dev it is picked up on the next request. On Vercel, redeploy.

---

## 6. Prompt and voice control

**Single source of truth.** `prompts/ask-amit.md` is the only file to edit for voice, rules, and behavior. It is read from disk on every API request, so in local development you can tweak the prompt and immediately test the new phrasing without restarting the dev server.

**Main rules encoded in the prompt.**

- First person as Dr. Amit Kapoor. "I argue", "in the book I make the case". Never break character.
- Plain economist English. Name real frameworks: 4S, Porter's Diamond, Social Progress Index, competitiveness-to-prosperity gap.
- 2 to 4 sentences, hard cap at 6. Short and crisp, no padding.
- No inline citations, no chunk numbers, no page refs, no markdown link syntax in the reply. The chips under the message carry provenance.
- Refuse cleanly if the retrieved passages do not cover the question: *"That's not something I've written about in the books we've indexed."* No extrapolation, no adjacent-topic fishing.
- A banned-vocabulary list to defeat AI-writing tells: em dashes, hedging phrases, transition filler, words like delve / tapestry / landscape / leverage / seamless / robust / holistic, vague endorsements, "In essence", "Ultimately", etc.

**How the route uses it.** `loadSystemPrompt()` calls `fs.readFileSync` on every POST and falls back to a minimal default if the file is missing. The file content becomes the first system block. The retrieved passages are the second system block, and that one carries the `ephemeral` cache marker so identical retrievals on repeat questions get cache-read pricing.

---

## 7. Cost and performance model

**Per-question token math (Sonnet 4.6 rates).**

- Input: system prompt (~400 tokens) + 6 retrieved chunks at ~500 tokens each (~3000) + prior turns (~600) ≈ **4000 input tokens**
- Output: 2 to 4 sentences ≈ **400 output tokens**
- Cold request: roughly **$0.02** per question
- Warm request (cache hit on the retrieved-context block): the big 3000-token block bills at cache-read rate (~10 percent of input), so cost drops to roughly **$0.003** per question

For prompt caching to fire, the cached block needs to clear Sonnet's ~2048-token minimum. With 6 chunks of 700-word passages, the context block sits well above that threshold, so caching is effective whenever the same retrieval repeats within the cache window.

**Latency budget.**

- Pinecone `searchRecords`: 300 to 500 ms
- Claude first token: 500 ms to 1 s
- Full 4-sentence reply: 1 to 3 s from first token to `message_stop`
- Total wall time from Enter-key to final token: roughly 1.5 to 3.5 s

**Pinecone free tier.** 250k embedding tokens per minute. The ingestion script handles this with the 15-second sleep between 50-record batches plus the 30s / 60s / 90s / 120s / 150s retry backoff on 429s. A one-time ingest of the full corpus (429 chunks) takes about 2 to 3 minutes.

---

## 8. Security and secrets

Five keys live in `.env.local`, none committed:

- `ANTHROPIC_API_KEY`, the Claude billing credential
- `PINECONE_API_KEY`, the vector DB credential
- `PINECONE_INDEX_NAME`, currently `ask-amit`
- `ELEVENLABS_API_KEY`, staged for Phase 2
- `ELEVENLABS_VOICE_ID`, the cloned-voice ID staged for Phase 2

`.env.local` is covered by Next.js's default `.gitignore`. For Vercel, set each of the five as a Project Environment Variable in the dashboard (Production + Preview). There is no client-side exposure: every key is read inside Node route handlers or the ingest script, never from browser code. The widget talks only to `/api/rag`, which talks to Anthropic and Pinecone on its behalf.

No rate limiting is in place in Phase 1. Hour 4 in the plan carves out 15 minutes for a simple IP-based cap (20 requests per hour) before any public launch.

---

## 9. What's next

**Hour 4, Deploy.** `vercel deploy`, add the env vars, smoke-test three production questions. Add the source-chip polish and the IP-based rate limiter if time allows.

**Hour 5, Phase 2 voice.** A new route `app/api/tts/route.ts` that takes the final answer text, calls `elevenlabs.textToSpeech.stream(voiceId, { text, modelId: 'eleven_turbo_v2_5', outputFormat: 'mp3_44100_128' })`, and pipes audio back as `audio/mpeg`. A "Listen" button next to each assistant bubble calls it, turns the response into a blob URL, and plays it through a hidden `<audio>` element. Voice ID configured via `ELEVENLABS_VOICE_ID` env var.

**Hour 6, Harden.** Tighten the prompt on edge cases, verify `usage.cache_read_input_tokens > 0` on a second identical request, mobile responsive sweep on the widget, document how to re-ingest when new content lands.

**Phase 3, Telephony.** Twilio or Vapi for inbound calls. Whisper transcribes caller audio, the existing RAG route produces an answer, ElevenLabs speaks it back. The RAG core does not change.

**Future internal staff dashboard.** Auth-gated page with no rate limits, unlimited queries, longer responses, and richer prompt controls for staff who need to pull exact quotes, draft emails in Amit's voice, and cross-check facts under deadline.

---

## 10. How to run it locally

```bash
# from C:\Users\muizz\Desktop\amit
npm install

# create .env.local with these keys (values from the respective dashboards):
#   ANTHROPIC_API_KEY=...
#   PINECONE_API_KEY=...
#   PINECONE_INDEX_NAME=ask-amit
#   ELEVENLABS_API_KEY=...
#   ELEVENLABS_VOICE_ID=your-voice-id

# one-time: ingest the corpus into Pinecone (takes 2 to 3 minutes)
npx tsx scripts/ingest.ts

# sanity-check retrieval
npx tsx scripts/query-test.ts

# boot the site
npm run dev

# open the widget
#   http://localhost:3000
```
