import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { Pinecone } from '@pinecone-database/pinecone'

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'ask-amit'
const NAMESPACE = 'books'

const QUERIES = [
  "What drives India's competitiveness?",
  'What is the Age of Awakening about?',
  'How does Porter\'s Diamond framework apply to India?',
  'What is the role of social progress in economic growth?',
  'What does Amit say about Indian agriculture?',
]

async function main() {
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
  const index = pc.index(INDEX_NAME).namespace(NAMESPACE)

  for (const query of QUERIES) {
    console.log(`\n─────────────────────────────────────────`)
    console.log(`Q: ${query}`)
    console.log(`─────────────────────────────────────────`)

    const results = await index.searchRecords({
      query: { topK: 3, inputs: { text: query } },
      fields: ['chunk_text', 'source', 'title', 'chunk_index'],
    })

    results.result.hits.forEach((hit: any, i: number) => {
      console.log(`\n  [${i + 1}] score=${hit._score.toFixed(3)} · ${hit.fields.title} · chunk ${hit.fields.chunk_index}`)
      console.log(`      ${hit.fields.chunk_text.slice(0, 200).replace(/\s+/g, ' ')}...`)
    })
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
