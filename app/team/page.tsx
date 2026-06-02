'use client'

import { useState, useRef, useEffect } from 'react'

const EMAIL_KEY = 'team_email'

type OutputFormat = 'chat' | 'article' | 'critique' | 'analysis' | 'infographic' | 'slides' | 'chart'
type Source = { title: string; chunk_index: number; score: number }
type Msg = {
  role: 'user' | 'ai'
  text: string
  sources?: Source[]
  webSearched?: boolean
  outputFormat?: OutputFormat
  confidence?: number
}

const FORMAT_LABELS: Record<OutputFormat, { label: string; icon: string; hint: string }> = {
  chat:        { label: 'Chat',        icon: '💬', hint: 'Conversational — go as deep as the question warrants' },
  article:     { label: 'Article',     icon: '📝', hint: '600–1500 words, op-ed voice, publishable' },
  critique:    { label: 'Critique',    icon: '🔍', hint: 'Structured feedback on a draft or argument' },
  analysis:    { label: 'Analysis',    icon: '📊', hint: 'Memo format with framework application + So What' },
  infographic: { label: 'Infographic', icon: '🎨', hint: 'Rendered HTML — visual data / key ideas at a glance' },
  slides:      { label: 'Slides',      icon: '📑', hint: 'Keyboard-navigable HTML deck (5–8 slides)' },
  chart:       { label: 'Chart',       icon: '📈', hint: 'Chart.js data visualisation — bar, line, radar, or doughnut' },
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const { label, bg, text, border } =
    score >= 0.78
      ? { label: 'High retrieval match', bg: 'rgba(16,185,129,.08)', text: '#6ee7b7', border: 'rgba(16,185,129,.25)' }
      : score >= 0.60
      ? { label: 'Moderate retrieval match', bg: 'rgba(245,158,11,.08)', text: '#fcd34d', border: 'rgba(245,158,11,.25)' }
      : { label: 'Low retrieval match — verify carefully', bg: 'rgba(239,68,68,.08)', text: '#fca5a5', border: 'rgba(239,68,68,.25)' }
  return (
    <span
      title="How closely the retrieved passages matched the question (cosine similarity, top-3 average)"
      style={{ background: bg, color: text, border: `1px solid ${border}` }}
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide"
    >
      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      {pct}% · {label}
    </span>
  )
}

const stripMarkdownForDisplay = (text: string) =>
  text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .trim()

export default function TeamPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('chat')
  const [streaming, setStreaming] = useState(false)
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(EMAIL_KEY)
    if (saved) setEmail(saved)
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleEmailSubmit = () => {
    const e = emailInput.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setEmailError('Enter a valid email address.')
      return
    }
    window.localStorage.setItem(EMAIL_KEY, e)
    setEmail(e)
    setEmailError('')
    setEmailInput('')
  }

  const handleSend = async () => {
    if (!input.trim() || streaming) return
    const userMsg: Msg = { role: 'user', text: input, outputFormat }
    const history = [...messages, userMsg]
    setMessages([...history, { role: 'ai', text: '', outputFormat }])
    setInput('')
    setHtmlPreview(null)
    setStreaming(true)

    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(email ? { 'X-User-Email': email } : {}),
        },
        body: JSON.stringify({
          messages: history.map((m) => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.text,
          })),
          outputFormat,
        }),
      })

      if (res.status === 401) {
        window.localStorage.removeItem(EMAIL_KEY)
        setEmail(null)
        throw new Error('Session expired.')
      }
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || 'Team access required.')
      }
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.type === 'text') {
              fullText += evt.text
              setMessages((prev) => {
                const lastIdx = prev.length - 1
                const last = prev[lastIdx]
                if (last?.role !== 'ai') return prev
                const next = prev.slice(0, lastIdx)
                next.push({ ...last, text: last.text + evt.text })
                return next
              })
            } else if (evt.type === 'sources') {
              setMessages((prev) => {
                const lastIdx = prev.length - 1
                const last = prev[lastIdx]
                if (last?.role !== 'ai') return prev
                const next = prev.slice(0, lastIdx)
                next.push({ ...last, sources: evt.sources, webSearched: evt.webSearched, confidence: evt.confidence })
                return next
              })
            } else if (evt.type === 'done') {
              if (outputFormat === 'infographic' || outputFormat === 'slides') {
                const htmlMatch = fullText.match(/<!DOCTYPE[^>]*>[\s\S]*/i) || fullText.match(/<html[\s\S]*/i)
                if (htmlMatch) setHtmlPreview(htmlMatch[0])
              }
            } else if (evt.type === 'error') {
              throw new Error(evt.error)
            }
          } catch {
            /* swallow malformed chunk */
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) => {
        const lastIdx = prev.length - 1
        const last = prev[lastIdx]
        if (last?.role !== 'ai' || last.text) return prev
        const next = prev.slice(0, lastIdx)
        next.push({ ...last, text: `Error: ${err.message}` })
        return next
      })
    } finally {
      setStreaming(false)
    }
  }

  const copyText = (text: string) => navigator.clipboard.writeText(text).catch(() => {})

  const downloadHtml = (html: string, filename: string) => {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-[#060e1a] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0a0a0a] via-[#2b2b2b] to-[#e63946] flex items-center justify-center text-white font-black text-sm">AK</div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">Team Dashboard</h1>
              <p className="text-[#64748b] text-[11px] mt-0.5">Internal · Dr. Amit Kapoor</p>
            </div>
          </div>
          <div className="bg-[#0B1929] border border-white/10 rounded-2xl p-6">
            <p className="text-[#94a3b8] text-[13px] leading-relaxed mb-5">
              This dashboard is for Amit's team only. Enter your authorised email to access long-form article drafting, analysis, critique, and infographic generation.
            </p>
            <input
              value={emailInput}
              onChange={(e) => { setEmailInput(e.target.value); if (emailError) setEmailError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
              placeholder="you@competitiveness.in"
              type="email"
              autoComplete="email"
              className="w-full bg-white/5 border border-white/10 text-white placeholder-white/25 px-4 py-3 rounded-xl text-[14px] focus:outline-none focus:border-[#e63946]/50 focus:ring-1 focus:ring-[#e63946]/20 mb-3"
            />
            {emailError && <p className="text-[#e63946] text-[11px] mb-3">{emailError}</p>}
            <button
              onClick={handleEmailSubmit}
              disabled={!emailInput.trim()}
              className="w-full bg-[#e63946] text-white py-3 rounded-xl font-bold text-[13px] tracking-wider uppercase hover:bg-[#c1121f] transition-colors disabled:opacity-40"
            >
              Access Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#060e1a] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/6 bg-[#0B1929]/80 backdrop-blur-sm px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0a0a0a] via-[#2b2b2b] to-[#e63946] flex items-center justify-center text-white font-black text-[11px]">AK</div>
        <div className="flex-1 min-w-0">
          <span className="text-white font-bold text-[14px]">Team Dashboard</span>
          <span className="text-[#64748b] text-[11px] ml-3">Internal · Dr. Amit Kapoor</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#475569] tracking-wide hidden sm:block">{email}</span>
          <button
            onClick={() => { window.localStorage.removeItem(EMAIL_KEY); setEmail(null); setMessages([]) }}
            className="text-[10px] text-[#475569] hover:text-[#e63946] transition-colors tracking-[1.5px] uppercase font-semibold"
          >
            Sign out
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setHtmlPreview(null) }}
              disabled={streaming}
              className="text-[10px] text-[#475569] hover:text-white transition-colors tracking-[1.5px] uppercase font-semibold disabled:opacity-40"
            >
              Clear
            </button>
          )}
        </div>
      </header>

      {/* Format selector */}
      <div className="border-b border-white/6 bg-[#0B1929]/40 px-6 py-2.5 flex items-center gap-2 flex-shrink-0 overflow-x-auto">
        <span className="text-[9px] text-[#475569] tracking-[2px] uppercase font-semibold mr-1 flex-shrink-0">Output</span>
        {(Object.keys(FORMAT_LABELS) as OutputFormat[]).map((fmt) => {
          const { label, icon } = FORMAT_LABELS[fmt]
          return (
            <button
              key={fmt}
              onClick={() => setOutputFormat(fmt)}
              title={FORMAT_LABELS[fmt].hint}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all flex-shrink-0 ${
                outputFormat === fmt
                  ? 'bg-[#e63946] text-white'
                  : 'bg-white/5 text-[#94a3b8] border border-white/8 hover:border-[#e63946]/40 hover:text-white'
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          )
        })}
        <span className="text-[10px] text-[#334155] ml-2 hidden md:block italic flex-shrink-0">
          {FORMAT_LABELS[outputFormat].hint}
        </span>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0a0a0a] via-[#2b2b2b] to-[#e63946] flex items-center justify-center text-white font-black text-xl">AK</div>
            <div>
              <p className="text-white font-bold text-lg mb-1">Ready for the team</p>
              <p className="text-[#475569] text-[13px] leading-relaxed max-w-md">
                Select an output format above, then ask anything. For long drafts, paste your text directly into the input — the agent will critique, expand, or reframe it in Amit's voice.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 w-full max-w-lg">
              {[
                { fmt: 'critique' as OutputFormat, q: 'Here\'s my draft section on India\'s competitiveness gap: [paste text]. Critique it through your frameworks.' },
                { fmt: 'article' as OutputFormat, q: 'Write a piece on why the West Asia crisis is a stress-test for India\'s competitiveness model.' },
                { fmt: 'analysis' as OutputFormat, q: 'Apply the 4S framework to India\'s AI sector — where are the gaps?' },
                { fmt: 'infographic' as OutputFormat, q: 'Create an infographic showing the competitiveness-to-prosperity gap across Indian states.' },
              ].map(({ fmt, q }, i) => (
                <button
                  key={i}
                  onClick={() => { setOutputFormat(fmt); setInput(q); textareaRef.current?.focus() }}
                  className="text-left text-[12px] text-[#64748b] bg-white/3 px-4 py-3 rounded-xl border border-white/6 hover:border-[#e63946]/30 hover:text-[#94a3b8] transition-all leading-snug"
                >
                  <span className="text-[#e63946] font-bold text-[10px] uppercase tracking-wider block mb-1">{FORMAT_LABELS[fmt].icon} {FORMAT_LABELS[fmt].label}</span>
                  {q.length > 80 ? q.slice(0, 80) + '…' : q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isLastAi = i === messages.length - 1 && msg.role === 'ai'
          const isHtmlOutput = (msg.outputFormat === 'infographic' || msg.outputFormat === 'slides' || msg.outputFormat === 'chart') && msg.role === 'ai'
          const uniqueTitles = msg.sources ? Array.from(new Set(msg.sources.map((s) => s.title))) : []

          return (
            <div key={i} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-4xl ${msg.role === 'ai' ? 'self-start w-full' : 'self-end'}`}>
              {msg.role === 'ai' && (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#0a0a0a] via-[#2b2b2b] to-[#e63946] flex items-center justify-center text-white font-black text-[8px]">AK</div>
                  <span className="text-[9px] tracking-[1.5px] uppercase text-[#475569] font-bold">Amit</span>
                  {msg.outputFormat && msg.outputFormat !== 'chat' && (
                    <span className="text-[9px] text-[#e63946] font-bold tracking-[1.5px] uppercase border border-[#e63946]/30 px-1.5 py-0.5 rounded-full bg-[#e63946]/6">
                      {FORMAT_LABELS[msg.outputFormat]?.icon} {FORMAT_LABELS[msg.outputFormat]?.label}
                    </span>
                  )}
                </div>
              )}

              {msg.role === 'user' ? (
                <div className="bg-[#e63946] text-white px-4 py-3 rounded-2xl rounded-br-md text-[14px] leading-relaxed max-w-[85%]">
                  {msg.text}
                </div>
              ) : (
                <div className="w-full">
                  {isHtmlOutput && htmlPreview && isLastAi ? (
                    <div className="border border-white/10 rounded-xl overflow-hidden">
                      <div className="bg-white/4 border-b border-white/6 px-4 py-2 flex items-center justify-between">
                        <span className="text-[10px] text-[#64748b] tracking-[1.5px] uppercase font-semibold">Preview</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => downloadHtml(htmlPreview, `amit-${msg.outputFormat}-${Date.now()}.html`)}
                            className="text-[10px] text-[#e63946] font-bold tracking-[1.5px] uppercase hover:text-white transition-colors"
                          >
                            Download HTML
                          </button>
                          <button
                            onClick={() => copyText(htmlPreview)}
                            className="text-[10px] text-[#64748b] font-bold tracking-[1.5px] uppercase hover:text-white transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <iframe
                        srcDoc={htmlPreview}
                        className="w-full h-[500px] bg-white"
                        sandbox="allow-scripts"
                        title="Generated output"
                      />
                    </div>
                  ) : (
                    <div className="bg-[#0B1929] border border-white/8 rounded-2xl rounded-tl-md px-5 py-4 text-[14px] text-[#cbd5e1] leading-[1.75] whitespace-pre-wrap w-full">
                      {msg.text || (isLastAi && streaming ? (
                        <span className="inline-flex gap-1 align-baseline">
                          <span className="w-1.5 h-1.5 bg-[#475569] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-[#475569] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-[#475569] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      ) : null)}
                      {isLastAi && streaming && msg.text && (
                        <span className="inline-flex gap-1 ml-1 align-baseline">
                          <span className="w-1.5 h-1.5 bg-[#475569] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-[#475569] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-[#475569] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      )}
                    </div>
                  )}

                  {/* Confidence + sources + disclaimer */}
                  {msg.role === 'ai' && !streaming && msg.text.length > 10 && (
                    <div className="flex flex-col gap-2 mt-2 px-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => copyText(msg.text)}
                          className="text-[10px] text-[#475569] hover:text-white transition-colors tracking-[1.5px] uppercase font-semibold"
                        >
                          Copy
                        </button>
                        {isHtmlOutput && htmlPreview && isLastAi && (
                          <button
                            onClick={() => downloadHtml(htmlPreview, `amit-${msg.outputFormat}-${Date.now()}.html`)}
                            className="text-[10px] text-[#e63946] hover:text-white transition-colors tracking-[1.5px] uppercase font-semibold"
                          >
                            Download HTML
                          </button>
                        )}
                        {typeof msg.confidence === 'number' && (
                          <ConfidenceBadge score={msg.confidence} />
                        )}
                        {(uniqueTitles.length > 0 || msg.webSearched) && (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <span className="text-[9px] text-[#334155] tracking-[1.5px] uppercase font-semibold">Sources</span>
                            {uniqueTitles.map((t, j) => (
                              <span key={j} className="text-[10px] text-[#64748b] bg-white/4 border border-white/8 px-2 py-0.5 rounded-full">{t}</span>
                            ))}
                            {msg.webSearched && (
                              <span className="text-[10px] text-[#3b82f6] bg-[#3b82f6]/8 border border-[#3b82f6]/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                                Web
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Persistent disclaimer */}
                      <p className="text-[10px] text-[#334155] leading-relaxed border-t border-white/5 pt-2">
                        ⚠️ AI-generated from Amit Kapoor's indexed works. Always cross-check with{' '}
                        <strong className="text-[#475569]">Dr. Amit Kapoor as the final authority</strong>{' '}
                        before use. Errors and omissions are possible.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div className="border-t border-white/6 bg-[#0B1929]/60 backdrop-blur-sm px-6 py-4 flex-shrink-0">
        <div className="flex gap-3 items-end max-w-4xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
            }}
            placeholder={
              streaming
                ? 'Generating...'
                : outputFormat === 'critique'
                ? 'Paste your draft here and ask for feedback...'
                : outputFormat === 'infographic'
                ? 'Describe the infographic you need...'
                : 'Ask anything, or paste a draft for critique...'
            }
            disabled={streaming}
            rows={3}
            className="flex-1 min-w-0 bg-white/5 border border-white/10 text-white placeholder-white/20 px-4 py-3 rounded-xl text-[14px] focus:outline-none focus:border-[#e63946]/50 focus:ring-1 focus:ring-[#e63946]/15 transition-all resize-none disabled:opacity-50 leading-relaxed"
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            className="bg-[#e63946] text-white px-5 py-3 rounded-xl hover:bg-[#c1121f] transition-colors font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 self-end"
            aria-label="Send"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
          </button>
        </div>
        <p className="text-[10px] text-[#334155] mt-2 text-center max-w-4xl mx-auto">
          ⌘↵ to send · {FORMAT_LABELS[outputFormat].icon} {FORMAT_LABELS[outputFormat].label} mode · Web search active · Admin: unlimited queries
        </p>
      </div>
    </div>
  )
}
