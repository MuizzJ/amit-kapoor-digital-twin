# Ask Amit

A digital-twin RAG chatbot for Dr. Amit Kapoor — economist, Chairman of the Institute for Competitiveness, and Stanford lecturer. Built as a Phase 1 MVP: visitors ask questions, the system retrieves from Amit's published work, and Claude answers in his voice. An ElevenLabs-cloned voice reads the answer aloud on demand.

Stack: Next.js 14 · Anthropic Claude Sonnet 4.6 · Pinecone (integrated inference) · ElevenLabs.

## What's in the box

- **Streaming RAG chat widget** — Pinecone semantic search + Claude streaming + source pills.
- **Voice playback** — "Listen" button on every answer, cloned voice via ElevenLabs.
- **Editable system prompt** (`prompts/ask-amit.md`) — first-person rule, banned AI-isms, source list.
- **Ingestion scripts** for PDF, PPTX, TXT, and YouTube transcripts.
- **Cluster visualization** (`cluster.html`) — interactive UMAP scatter of the knowledge base colored by k-means topic clusters (Claude-labeled).
- **Summary page** (`summary.html`) — brand-styled one-pager with architecture, costs, stack.

## Architecture

```mermaid
flowchart TB
    subgraph ingest ["&nbsp;Ingest &middot; offline&nbsp;"]
        SRC["PDF &nbsp;&middot;&nbsp; PPTX &nbsp;&middot;&nbsp; TXT &nbsp;&middot;&nbsp; YouTube"]
        ING["<b>scripts/ingest.ts</b><br/><i>chunk 700w, 100 overlap</i>"]
        SRC --> ING
    end

    subgraph query ["&nbsp;Query &middot; live&nbsp;"]
        W["<b>Browser Widget</b>"]
        RAG["<b>/api/rag</b>"]
        CLAUDE["<b>Claude Sonnet 4.6</b><br/><i>streaming</i>"]
        W -- "POST question" --> RAG
        RAG -- "context + prompt" --> CLAUDE
        CLAUDE -- "SSE tokens" --> W
    end

    subgraph voice ["&nbsp;Voice &middot; on demand&nbsp;"]
        TTS["<b>/api/tts</b>"]
        EL["<b>ElevenLabs</b><br/><i>cloned voice</i>"]
        W -- "Listen click" --> TTS
        TTS --> EL
        EL -- "MP3 stream" --> W
    end

    PC[("<b>Pinecone</b><br/><i>llama-text-embed-v2, 1024-dim</i>")]
    ING -- "upsert" --> PC
    RAG -- "top-k search" --> PC
    PC -- "chunks" --> RAG

    classDef store fill:#dcfce7,stroke:#16a34a,color:#14532d,stroke-width:2px
    classDef ai fill:#fce7f3,stroke:#db2777,color:#831843
    classDef client fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
    classDef route fill:#ede9fe,stroke:#7c3aed,color:#4c1d95
    classDef source fill:#f1f5f9,stroke:#64748b,color:#0f172a

    class PC store
    class CLAUDE,EL ai
    class W client
    class RAG,TTS,ING route
    class SRC source
```

See `ARCHITECTURE.md` for the detailed end-to-end breakdown.

## Setup

### 1. Prerequisites
- Node.js 18+
- Accounts: [Anthropic](https://console.anthropic.com/), [Pinecone](https://app.pinecone.io/), [ElevenLabs](https://elevenlabs.io/)

### 2. Install
```bash
git clone https://github.com/MuizzJ/amit-kapoor-digital-twin.git
cd amit-kapoor-digital-twin
npm install
```

### 3. Configure
```bash
cp .env.example .env.local
# edit .env.local with your four keys + Pinecone index name + ElevenLabs voice ID
```

### 4. Create the Pinecone index
In the Pinecone console, create a **serverless** index:
- Name: matches `PINECONE_INDEX_NAME` in `.env.local` (default: `ask-amit`)
- Dimensions: **1024**
- Metric: cosine
- Embedding model: **llama-text-embed-v2** (integrated inference)

### 5. Add source material
Drop files into `data/` (gitignored — your own content stays local):
- PDFs, PPTX, or TXT files
- For TXT essays, add a header line: `Published in <venue> on <date>`

### 6. Register each source
Edit `scripts/ingest.ts` → add an entry to `TITLE_MAP` (display title + venue + date).
Edit `prompts/ask-amit.md` → add a bullet under the sources list.

### 7. Ingest
```bash
# single file:
npx tsx scripts/ingest.ts "The_Age_of_Awakening_Final.pdf"

# or all files in data/:
npx tsx scripts/ingest.ts
```

### 8. Run
```bash
npm run dev
# open http://localhost:3000 (or :3001 if 3000 is busy)
```

## Workflows

### Add a YouTube video
```bash
npx tsx scripts/fetch-youtube.ts "https://www.youtube.com/watch?v=VIDEO_ID"
```
The helper prints a ready-to-paste `TITLE_MAP` entry + prompt bullet + ingest command.

### Regenerate the cluster map
```bash
npx tsx scripts/export-clusters.ts        # ~2 min, re-labels via Claude
npx tsx scripts/generate-cluster-html.ts  # rewrites cluster.html with fresh data
```

## Project layout

```
app/
  api/
    rag/route.ts     streaming RAG endpoint (Pinecone + Claude)
    tts/route.ts     ElevenLabs voice synthesis stream
  page.tsx           landing page
components/
  VoiceWidget.tsx    chat widget (streaming, source pills, Listen button)
scripts/
  ingest.ts             chunk + embed + upsert pipeline
  fetch-youtube.ts      transcript + metadata scraper
  export-clusters.ts    UMAP + k-means + Claude labels → clusters-data.json
  generate-cluster-html.ts   inlines data into cluster.html
prompts/
  ask-amit.md        editable system prompt, live-reloaded each request
data/                source material (gitignored)
```

## Roadmap

- [ ] Deploy to Vercel with shared-secret auth
- [ ] MCP wrapper (`ask-amit-mcp`) so Amit can call from his own Claude Code
- [ ] Voice input (mic button → Web Speech API or Whisper)
- [ ] Staff dashboard with Ask / Critique / Draft modes
- [ ] Phase 3: Twilio telephony (Whisper STT → RAG → ElevenLabs TTS)

## License

Private. Source material in `data/` is the intellectual property of Dr. Amit Kapoor and his publishers.
