# Ask Amit — 6-Hour MVP Execution Plan

**Target:** Phase 1 (RAG chatbot wired into existing `AskAmitWidget`) shipped to Vercel, plus Phase 2 "Listen" button with ElevenLabs voice playback, in a single 6-hour session.

**Stack decisions (locked):**
- Generator: `claude-sonnet-4-6` via `@anthropic-ai/sdk` (streaming with `.toReadableStream()`)
- Vectors: Pinecone with **integrated inference** (`llama-text-embed-v2`) — no separate embedding API
- Voice: `@elevenlabs/elevenlabs-js` with `eleven_turbo_v2_5`
- Deploy: Vercel, secrets via dashboard env vars

**Integration point:** `components/VoiceWidget.tsx` line 31 placeholder → real RAG stream.

---

## Hour 0 — Prerequisites (block before starting)

Must be resolved or Hour 1 can't begin:

- [ ] **Source documents**: path(s) to EPUBs / PDFs / transcripts on disk (or download links). Nothing found on Desktop/Downloads/Documents at last check.
- [ ] `ANTHROPIC_API_KEY` (console.anthropic.com)
- [ ] Pinecone account + `PINECONE_API_KEY`
- [ ] ElevenLabs account + `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` (Phase 2 only — can defer to Hour 5)

---

## Hour 1 — Data Ingestion Pipeline

- **0:00–0:10** Install: `@pinecone-database/pinecone @anthropic-ai/sdk pdf-parse epub2 tsx dotenv`. Create `.env.local`, add to `.gitignore`.
- **0:10–0:20** Create Pinecone index via dashboard: name `ask-amit`, serverless, cosine metric. Pick model with integrated inference (`llama-text-embed-v2`, 1024 dims).
- **0:20–1:00** Write `scripts/ingest.ts`:
  - Walk `/data` folder
  - Parse by format (EPUB → text, PDF → text via pdf-parse, TXT passthrough)
  - Chunk: ~700 tokens with 100 overlap
  - Metadata per chunk: `{ source, title, chunk_index, excerpt }`
  - Upsert to Pinecone (integrated inference does the embedding server-side)

## Hour 2 — Ingest + Validate Retrieval

- **1:00–1:40** Run `npx tsx scripts/ingest.ts` on real data. Fix encoding/parsing errors as they appear.
- **1:40–2:00** `scripts/query-test.ts`: run 5 gotcha questions ("What is Porter's Diamond?", "How does India measure competitiveness?"). Print top-5 matches per query. Confirm retrieval surfaces relevant chunks. If not, revisit chunk size.

## Hour 3 — API Route + Frontend Wire

- **2:00–2:40** `app/api/rag/route.ts`:
  - POST `{ messages }`
  - Embed latest user message (or let Pinecone do it with integrated inference)
  - `index.query({ topK: 5, includeMetadata: true })`
  - Build system prompt: persona + strict "only answer from context, cite sources, say 'I don't have that in my materials' otherwise"
  - `client.messages.stream({ model: "claude-sonnet-4-6", system: [{ type: "text", text, cache_control: { type: "ephemeral" } }], messages })`
  - `return stream.toReadableStream()`
- **2:40–3:00** Rewire `components/VoiceWidget.tsx:24-35` (`handleSend`): POST to `/api/rag`, read the stream, append tokens incrementally to the last assistant message. Remove the placeholder at line 31.

## Hour 4 — Polish + Deploy Phase 1

- **3:00–3:25** Source chips: render `metadata.title` + `chunk_index` as clickable pills under each AI response.
- **3:25–3:40** Basic rate limit (IP-based counter, 20 req/hour) to protect key spend.
- **3:40–4:00** `vercel deploy`. Add env vars in dashboard. Smoke-test production URL with 3 real questions. **Phase 1 is live.**

## Hour 5 — Phase 2: ElevenLabs Voice

- **4:00–4:10** `npm i @elevenlabs/elevenlabs-js`. Add `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` to `.env.local` and Vercel.
- **4:10–4:40** `app/api/tts/route.ts`:
  ```ts
  const audioStream = await client.textToSpeech.stream(voiceId, {
    text, modelId: "eleven_turbo_v2_5", outputFormat: "mp3_44100_128"
  });
  return new Response(audioStream, { headers: { "Content-Type": "audio/mpeg" } });
  ```
- **4:40–5:00** Add "🔊 Listen" button next to each assistant message in `VoiceWidget.tsx`. On click: `fetch('/api/tts')` → `blob()` → `URL.createObjectURL` → `<audio>.play()`. Disable button while playing; show spinner during first-byte wait.

## Hour 6 — Harden + Ship

- **5:00–5:20** System prompt tuning: tight persona, anti-hallucination rules, citation format. Re-test 10 queries (5 in-corpus, 5 out-of-corpus — latter should refuse cleanly).
- **5:20–5:40** Mobile responsive check on the widget. Error states: API failure, rate-limit hit, empty retrieval.
- **5:40–6:00** Final deploy. Verify prompt caching is working (`usage.cache_read_input_tokens > 0` on second request). Write 10-line README section on how to re-ingest when new content arrives.

---

## Cut lines (if running behind)

- **Skip Hour 5–6 voice**: Phase 2 is explicitly separable. Ship Phase 1 at Hour 4 and call it done.
- **Skip source chips** (Hour 4 polish): nice-to-have, not blocking.
- **Skip rate limit**: only matters if you publish the URL. Fine for a soft launch.

## Risks

1. **Data not on disk** — biggest blocker. Hour 1 cannot start without it.
2. **Chunking quality** — book-length EPUBs with chapters need smarter splitting than naive character count. If Hour 2 validation looks bad, invest another 20 min in chapter-aware chunking.
3. **Prompt caching doesn't fire** — min threshold is ~2048 tokens for Sonnet 4.6. If your concatenated retrieval context is smaller, cache reads will be zero. Fine functionally, just more expensive per request.
4. **ElevenLabs latency on long replies** — blob-URL playback waits for full audio. If responses routinely exceed 800 chars, consider upgrading to MediaSource streaming (extra ~40 min).
