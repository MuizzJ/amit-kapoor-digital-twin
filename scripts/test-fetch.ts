import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { Pinecone } from '@pinecone-database/pinecone'

async function main() {
  const idx = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
    .index('ask-amit')
    .namespace('books')

  const r: any = await idx.fetch({ ids: ['riding_the_tiger_0000', 'ai_growth_beyond_metros_0000'] })
  const container = r.records || r.vectors
  const keys = Object.keys(container || {})
  console.log('keys:', keys)
  if (keys.length) {
    const first = container[keys[0]]
    console.log('first record keys:', Object.keys(first))
    console.log('values length:', first.values?.length)
    console.log('metadata keys:', Object.keys(first.metadata || {}))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
