import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { Pinecone } from '@pinecone-database/pinecone'
// @ts-ignore
import { PDFParse } from 'pdf-parse'
// @ts-ignore
import AdmZip from 'adm-zip'

function extractPptxText(filePath: string): string {
  const zip = new AdmZip(filePath)
  const slideEntries = zip
    .getEntries()
    .filter((e: any) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a: any, b: any) => {
      const na = parseInt(a.entryName.match(/slide(\d+)/)![1], 10)
      const nb = parseInt(b.entryName.match(/slide(\d+)/)![1], 10)
      return na - nb
    })
  const parts: string[] = []
  for (const entry of slideEntries) {
    const xml = entry.getData().toString('utf8')
    const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || []
    const slideText = matches
      .map((m) => m.replace(/<a:t[^>]*>([^<]*)<\/a:t>/, '$1'))
      .join(' ')
    if (slideText.trim()) parts.push(slideText)
  }
  return parts.join('\n\n')
}

const DATA_DIR = path.join(process.cwd(), 'data')
const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'ask-amit'
const NAMESPACE = 'books'

const TITLE_MAP: Record<string, string> = {
  'The_Age_of_Awakening_Final.pdf': 'The Age of Awakening',
  'The Elephant Moves_Royal_Final.pdf': 'The Elephant Moves',
  'Riding_The_Tiger.md': 'Riding the Tiger',
  'Riding_The_Tiger.pptx': 'Riding the Tiger',
  'AI_Growth_Beyond_Metros.txt': "AI Growth Beyond Metros, Financial Express (Mar 2026)",
  'Urban_Fault_Line.txt': "Invisible Urban Fault Line, Business Standard (Mar 2026)",
  'yt_Keynote_by_Amit_Kapoor_Chairman_Institute_for_Competitiveness_and_Lecturer_Stanf_8hE4HVq67R0.txt':
    'Keynote, Arthsastra (YouTube)',
}

const CHUNK_WORDS = 700
const OVERLAP_WORDS = 100
const BATCH_SIZE = 50
const BATCH_DELAY_MS = 15_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function cleanMarkdown(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\(data:[^)]+\)/g, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_`]{1,3}([^*_`]+)[*_`]{1,3}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}

function chunkText(text: string): string[] {
  const clean = cleanMarkdown(text).replace(/\s+/g, ' ').trim()
  const words = clean.split(' ')
  if (words.length <= CHUNK_WORDS) return [clean]
  const chunks: string[] = []
  const step = CHUNK_WORDS - OVERLAP_WORDS
  for (let i = 0; i < words.length; i += step) {
    const slice = words.slice(i, i + CHUNK_WORDS).join(' ')
    if (slice.trim().length > 50) chunks.push(slice)
    if (i + CHUNK_WORDS >= words.length) break
  }
  return chunks
}

function slugify(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase()
}

async function ensureIndex(pc: Pinecone) {
  const list = await pc.listIndexes()
  const exists = list.indexes?.some((i) => i.name === INDEX_NAME)
  if (exists) {
    console.log(`✓ Index "${INDEX_NAME}" already exists`)
    return
  }
  console.log(`Creating index "${INDEX_NAME}" with llama-text-embed-v2...`)
  await pc.createIndexForModel({
    name: INDEX_NAME,
    cloud: 'aws',
    region: 'us-east-1',
    embed: {
      model: 'llama-text-embed-v2',
      fieldMap: { text: 'chunk_text' },
    },
    waitUntilReady: true,
  })
  console.log(`✓ Index created`)
}

async function parseFile(filePath: string): Promise<string> {
  console.log(`  Parsing ${path.basename(filePath)}...`)
  const ext = path.extname(filePath).toLowerCase()
  let text = ''
  if (ext === '.pdf') {
    const buffer = fs.readFileSync(filePath)
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    text = result.text
    await parser.destroy()
  } else if (ext === '.md' || ext === '.txt') {
    text = fs.readFileSync(filePath, 'utf8')
  } else if (ext === '.pptx') {
    text = extractPptxText(filePath)
  }
  console.log(`  → ${(text?.length || 0).toLocaleString()} chars extracted`)
  return text || ''
}

async function main() {
  if (!process.env.PINECONE_API_KEY) throw new Error('PINECONE_API_KEY missing')

  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
  await ensureIndex(pc)
  const index = pc.index(INDEX_NAME).namespace(NAMESPACE)

  const onlyArg = process.argv[2]
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => !f.startsWith('~') && !f.startsWith('.'))
    .filter((f) => /\.(pdf|txt|pptx)$/i.test(f))
    .filter((f) => !onlyArg || f === onlyArg)

  console.log(`Found ${files.length} source files in /data\n`)

  let totalChunks = 0
  const allRecords: any[] = []

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file)
    const title = TITLE_MAP[file] || file
    const slug = slugify(file)

    try {
      const text = await parseFile(filePath)
      const chunks = chunkText(text)
      console.log(`  → ${chunks.length} chunks\n`)

      chunks.forEach((chunk, i) => {
        allRecords.push({
          _id: `${slug}_${i.toString().padStart(4, '0')}`,
          chunk_text: chunk,
          source: file,
          title,
          chunk_index: i,
          excerpt: chunk.slice(0, 200),
        })
      })
      totalChunks += chunks.length
    } catch (err: any) {
      console.error(`  ✗ Failed to parse ${file}: ${err.message}\n`)
    }
  }

  console.log(`\nUpserting ${allRecords.length} records to Pinecone (${NAMESPACE} namespace)...`)
  for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
    const batch = allRecords.slice(i, i + BATCH_SIZE)
    let attempt = 0
    while (true) {
      try {
        await index.upsertRecords({ records: batch })
        break
      } catch (err: any) {
        attempt++
        const msg = String(err?.message || err)
        const is429 = msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')
        if (is429 && attempt <= 5) {
          const wait = 30_000 * attempt
          console.log(`  ⏸ rate limit — waiting ${wait / 1000}s (attempt ${attempt}/5)`)
          await sleep(wait)
          continue
        }
        throw err
      }
    }
    console.log(`  ${Math.min(i + BATCH_SIZE, allRecords.length)}/${allRecords.length}`)
    if (i + BATCH_SIZE < allRecords.length) await sleep(BATCH_DELAY_MS)
  }

  console.log(`\n✓ Ingestion complete. ${totalChunks} chunks indexed.`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
