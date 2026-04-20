import * as fs from 'fs'
import * as path from 'path'
// @ts-ignore
import { YoutubeTranscript } from 'youtube-transcript'

const DATA_DIR = path.join(process.cwd(), 'data')

function parseVideoId(url: string): string {
  const m =
    url.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ||
    url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/) ||
    url.match(/embed\/([a-zA-Z0-9_-]{11})/)
  if (!m) throw new Error(`Could not extract video ID from: ${url}`)
  return m[1]
}

function slugify(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

function secondsToClock(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return h
    ? `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    : `${m}:${sec.toString().padStart(2, '0')}`
}

async function fetchMeta(videoId: string) {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`oEmbed failed: ${res.status}`)
  return (await res.json()) as { title: string; author_name: string; author_url: string }
}

async function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.error('Usage: npx tsx scripts/fetch-youtube.ts <youtube-url>')
    process.exit(1)
  }

  const videoId = parseVideoId(arg)
  console.log(`Video ID: ${videoId}`)

  const [meta, transcript] = await Promise.all([
    fetchMeta(videoId),
    YoutubeTranscript.fetchTranscript(videoId),
  ])

  const duration =
    transcript.length > 0
      ? secondsToClock(
          transcript[transcript.length - 1].offset / 1000 +
            transcript[transcript.length - 1].duration / 1000
        )
      : 'unknown'

  console.log(`Title: ${meta.title}`)
  console.log(`Channel: ${meta.author_name}`)
  console.log(`Duration: ${duration}`)
  console.log(`Transcript segments: ${transcript.length}`)

  const body = transcript
    .map((seg: any) => seg.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  const header = [
    meta.title,
    '',
    `YouTube video. Channel: ${meta.author_name}. Duration: ${duration}.`,
    `URL: https://www.youtube.com/watch?v=${videoId}`,
    `Video ID: ${videoId}.`,
    '',
    '--- TRANSCRIPT ---',
    '',
  ].join('\n')

  const slug = slugify(meta.title)
  const filename = `yt_${slug}_${videoId}.txt`
  const outPath = path.join(DATA_DIR, filename)
  fs.writeFileSync(outPath, header + body + '\n', 'utf8')

  const chars = body.length
  console.log(`\n✓ Wrote ${outPath}`)
  console.log(`  Body: ${chars.toLocaleString()} chars (~${Math.round(chars / 5).toLocaleString()} words)`)
  console.log(`\nNext steps:`)
  console.log(`  1. Add this to TITLE_MAP in scripts/ingest.ts:`)
  console.log(`     '${filename}': '${meta.title.replace(/'/g, "\\'")} (YouTube)',`)
  console.log(`  2. Add this line to prompts/ask-amit.md source list:`)
  console.log(`     - **${meta.title}.** YouTube interview/talk. Channel: ${meta.author_name}. Duration ${duration}.`)
  console.log(`  3. Ingest it: npx tsx scripts/ingest.ts ${filename}`)
}

main().catch((err) => {
  console.error('\nFatal:', err.message)
  if (err.message?.includes('disabled')) {
    console.error('\nThis video has captions disabled. Options:')
    console.error('  - Download audio with yt-dlp and transcribe via Whisper API')
    console.error('  - Ask the uploader to enable auto-captions')
  }
  process.exit(1)
})
