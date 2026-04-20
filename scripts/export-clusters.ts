import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import * as fs from 'fs'
import * as path from 'path'
import { Pinecone } from '@pinecone-database/pinecone'
// @ts-ignore
import { UMAP } from 'umap-js'
// @ts-ignore
import { kmeans } from 'ml-kmeans'
import Anthropic from '@anthropic-ai/sdk'

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'ask-amit'
const NAMESPACE = 'books'
const K_CLUSTERS = 8
const KNN = 2

type Rec = {
  id: string
  values: number[]
  metadata: {
    chunk_text: string
    title: string
    chunk_index: number
    excerpt: string
    source: string
  }
}

function cosine(a: number[], b: number[]): number {
  let d = 0, ma = 0, mb = 0
  for (let i = 0; i < a.length; i++) {
    d += a[i] * b[i]
    ma += a[i] * a[i]
    mb += b[i] * b[i]
  }
  return d / (Math.sqrt(ma) * Math.sqrt(mb) || 1)
}

function euclidean(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2
  return Math.sqrt(s)
}

async function listAllIds(idx: any): Promise<string[]> {
  const ids: string[] = []
  let token: string | undefined
  do {
    const r: any = await idx.listPaginated({ limit: 100, paginationToken: token })
    for (const v of r.vectors || []) ids.push(v.id)
    token = r.pagination?.next
  } while (token)
  return ids
}

async function fetchAll(idx: any, ids: string[]): Promise<Rec[]> {
  const BATCH = 100
  const recs: Rec[] = []
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH)
    const r: any = await idx.fetch({ ids: batch })
    const container = r.records || r.vectors
    for (const id of batch) {
      const rec = container[id]
      if (rec?.values) {
        recs.push({ id, values: rec.values, metadata: rec.metadata })
      }
    }
    console.log(`  fetched ${Math.min(i + BATCH, ids.length)}/${ids.length}`)
  }
  return recs
}

async function labelCluster(
  client: Anthropic,
  samples: string[],
  sourcesInCluster: string[]
): Promise<string> {
  const prompt = `Give a 2 to 4 word topic label for these excerpts from Dr. Amit Kapoor's economics writing. Be specific and concrete. Examples of good labels: "India competitiveness drivers", "Social progress metrics", "AI policy gaps", "Independence-era economics".

Return ONLY the label, nothing else. No quotes, no punctuation except hyphens or commas.

Sources in this cluster: ${sourcesInCluster.join(', ')}

Excerpts:
${samples.map((s, i) => `${i + 1}. ${s.slice(0, 400)}`).join('\n\n')}`

  const r = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 40,
    messages: [{ role: 'user', content: prompt }],
  })
  const t = r.content[0]
  if (t.type !== 'text') return 'Topic'
  return t.text.trim().replace(/^["'\s]+|["'\s.]+$/g, '').slice(0, 40)
}

async function main() {
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
  const idx = pc.index(INDEX_NAME).namespace(NAMESPACE)

  console.log('Listing IDs...')
  const ids = await listAllIds(idx)
  console.log(`→ ${ids.length} records\n`)

  console.log('Fetching vectors...')
  const recs = await fetchAll(idx, ids)
  console.log(`→ ${recs.length} vectors (dim ${recs[0]?.values.length})\n`)

  console.log('Running UMAP (1024 dim → 2D)...')
  const umap = new UMAP({ nComponents: 2, nNeighbors: 15, minDist: 0.15 })
  const coords2d: number[][] = umap.fit(recs.map((r) => r.values))
  console.log('→ done\n')

  console.log(`Running k-means (k=${K_CLUSTERS})...`)
  const km: any = kmeans(recs.map((r) => r.values), K_CLUSTERS, {
    maxIterations: 100,
    seed: 42,
  })
  console.log('→ done\n')

  console.log('Labeling clusters with Claude...')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const labels: string[] = []
  for (let c = 0; c < K_CLUSTERS; c++) {
    const centroid = km.centroids[c]
    const members = recs
      .map((r, i) => ({ i, d: euclidean(r.values, centroid) }))
      .filter((m) => km.clusters[m.i] === c)
      .sort((a, b) => a.d - b.d)
    const sources = [...new Set(members.slice(0, 10).map((m) => recs[m.i].metadata.title))]
    const samples = members
      .slice(0, 5)
      .map((m) => recs[m.i].metadata.excerpt || recs[m.i].metadata.chunk_text.slice(0, 300))
    const label = samples.length > 0 ? await labelCluster(client, samples, sources) : 'Empty'
    console.log(`  cluster ${c} (${members.length} chunks): ${label}`)
    labels.push(label)
  }
  console.log()

  console.log('Computing kNN...')
  const neighbors: number[][] = []
  for (let i = 0; i < recs.length; i++) {
    const sims: Array<[number, number]> = []
    for (let j = 0; j < recs.length; j++) {
      if (i === j) continue
      sims.push([j, cosine(recs[i].values, recs[j].values)])
    }
    sims.sort((a, b) => b[1] - a[1])
    neighbors.push(sims.slice(0, KNN).map((s) => s[0]))
  }
  console.log('→ done\n')

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [x, y] of coords2d) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const rX = maxX - minX || 1, rY = maxY - minY || 1

  const points = recs.map((r, i) => ({
    id: r.id,
    x: Math.round(((coords2d[i][0] - minX) / rX) * 1000) / 1000,
    y: Math.round(((coords2d[i][1] - minY) / rY) * 1000) / 1000,
    cluster: km.clusters[i],
    title: r.metadata.title,
    chunk_index: r.metadata.chunk_index,
    excerpt: (r.metadata.excerpt || r.metadata.chunk_text.slice(0, 220))
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 260),
    source: r.metadata.source,
    neighbors: neighbors[i],
  }))

  const sourcesSet = [...new Set(recs.map((r) => r.metadata.title))]

  const data = {
    points,
    labels,
    sources: sourcesSet,
    generatedAt: new Date().toISOString(),
  }

  const outJson = path.join(process.cwd(), 'clusters-data.json')
  fs.writeFileSync(outJson, JSON.stringify(data))
  console.log(`✓ Wrote ${outJson} (${(JSON.stringify(data).length / 1024).toFixed(1)} KB)`)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
