'use client'

import { useState, useRef, useEffect } from 'react'

const EMAIL_KEY = 'ask_amit_email'

const QUESTION_POOL = [
  "What drives India's competitiveness?",
  'How does the 4S framework work?',
  'Core argument of Age of Awakening?',
  "India's invisible urban fault line?",
  'Can AI grow beyond the metros?',
  "Nehru-era policy's legacy today?",
  'What did 1991 actually change?',
  'Strategy for emerging-market leaders?',
  'Competitiveness vs prosperity gap?',
  'Why the civic compact matters?',
  'How to read Indira-era economics?',
  'What does SPI miss about India?',
  'Post-reform progress by region?',
  'AI constraints in Tier 2/3 cities?',
]

const FOLLOWUP_BY_SOURCE: Record<string, string[]> = {
  'Age of Awakening': [
    'What drove the 1991 turn?',
    "Nehru-era's legacy today?",
    'Indira-era political economy?',
    "India's pre-1991 trap?",
  ],
  'Elephant Moves': [
    'Define the 4S framework',
    'Competitiveness vs prosperity?',
    'How do Indian states diverge?',
    'Path to shared prosperity?',
  ],
  'Riding the Tiger': [
    'Strategy for EM leaders?',
    'Biggest risks to manage?',
    'What makes tigers different?',
  ],
  'Urban Fault Line': [
    'What is the civic compact?',
    'Why ward-level participation?',
    'Beyond capex reforms?',
    'Who enforces accountability?',
  ],
  'AI Growth Beyond Metros': [
    'Tier 2/3 AI constraints?',
    'Compute vs skills gap?',
    'A phased AI rollout?',
    'Who finances the gap?',
  ],
  Arthsastra: [
    'Your Stanford thesis?',
    "India's growth path?",
    'Role of institutions?',
  ],
}

const GENERAL_FOLLOWUPS = [
  'Why does this matter now?',
  'What would you do first?',
  'Where is the tension?',
  'Any numbers to anchor this?',
]

const sampleN = <T,>(pool: T[], n: number): T[] => {
  const copy = [...pool]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}

const sampleThree = (pool: string[]): string[] => sampleN(pool, 3)

const getFollowups = (sourceTitles: string[], alreadyAsked: Set<string>): string[] => {
  const buckets: string[] = []
  for (const title of sourceTitles) {
    for (const key of Object.keys(FOLLOWUP_BY_SOURCE)) {
      if (title.toLowerCase().includes(key.toLowerCase())) {
        buckets.push(...FOLLOWUP_BY_SOURCE[key])
      }
    }
  }
  const seen = new Set<string>()
  const unique = buckets.filter((q) => {
    const k = q.toLowerCase()
    if (seen.has(k) || alreadyAsked.has(k)) return false
    seen.add(k)
    return true
  })
  const picked = sampleN(unique, 3)
  if (picked.length < 3) {
    const filler = GENERAL_FOLLOWUPS.filter(
      (q) => !alreadyAsked.has(q.toLowerCase()) && !picked.includes(q),
    )
    picked.push(...sampleN(filler, 3 - picked.length))
  }
  return picked
}

type Source = { title: string; chunk_index: number; score: number }
type Msg = { role: 'user' | 'ai'; text: string; sources?: Source[]; webSearched?: boolean }

const stripInlineCitations = (text: string): string =>
  text
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s*\[[^\]]*?(?:chunk|pg|page|p\.\s*\d|passage|book)[^\]]*?\]/gi, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*\n]+?)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1$2')
    .replace(/(^|[^_\w])_([^_\n]+?)_(?![_\w])/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`([^`\n]+?)`/g, '$1')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

function AmitMonogram({ size = 36 }: { size?: number }) {
  return (
    <div
      className="flex-shrink-0 rounded-full flex items-center justify-center font-display font-black text-white shadow-md"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #0a0a0a 0%, #2b2b2b 60%, #e63946 140%)',
        fontSize: size * 0.38,
        letterSpacing: '-0.02em',
      }}
    >
      AK
    </div>
  )
}

function PlayIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function StopIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 6h12v12H6z" />
    </svg>
  )
}

function SpinnerIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function AskAmitWidget() {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(() => sampleThree(QUESTION_POOL))
  const [streaming, setStreaming] = useState(false)
  const [playingIdx, setPlayingIdx] = useState<number | null>(null)
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(EMAIL_KEY)
    if (saved) setUserEmail(saved)
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  useEffect(() => {
    if (open && !streaming) inputRef.current?.focus()
  }, [open, streaming])

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current)
        currentUrlRef.current = null
      }
    }
  }, [])

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current)
      currentUrlRef.current = null
    }
    setPlayingIdx(null)
    setLoadingIdx(null)
  }

  const handleEmailSubmit = () => {
    const e = emailInput.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setEmailError('Enter a valid email address.')
      return
    }
    window.localStorage.setItem(EMAIL_KEY, e)
    setUserEmail(e)
    setEmailError(null)
    setEmailInput('')
  }

  const handleSignOut = () => {
    stopAudio()
    window.localStorage.removeItem(EMAIL_KEY)
    setUserEmail(null)
    setMessages([])
    setSuggestedQuestions(sampleThree(QUESTION_POOL))
  }

  const handleListen = async (idx: number, text: string) => {
    if (playingIdx === idx) {
      stopAudio()
      return
    }
    stopAudio()
    setLoadingIdx(idx)

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userEmail ? { 'X-User-Email': userEmail } : {}),
        },
        body: JSON.stringify({ text }),
      })
      if (res.status === 401) {
        handleSignOut()
        throw new Error('Session expired — please re-enter your email.')
      }
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || 'Listen cap reached.')
      }
      if (!res.ok) throw new Error(`TTS failed (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      currentUrlRef.current = url

      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        if (currentUrlRef.current === url) {
          URL.revokeObjectURL(url)
          currentUrlRef.current = null
          audioRef.current = null
          setPlayingIdx(null)
        }
      }
      audio.onerror = () => {
        stopAudio()
      }
      await audio.play()
      setLoadingIdx(null)
      setPlayingIdx(idx)
    } catch (err) {
      console.error('Listen error:', err)
      setLoadingIdx(null)
      setPlayingIdx(null)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || streaming) return
    stopAudio()
    const userMsg: Msg = { role: 'user', text: input }
    const history = [...messages, userMsg]
    setMessages([...history, { role: 'ai', text: '' }])
    setInput('')
    setStreaming(true)

    try {
      const res = await fetch('/api/rag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userEmail ? { 'X-User-Email': userEmail } : {}),
        },
        body: JSON.stringify({
          messages: history.map((m) => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.text,
          })),
        }),
      })

      if (res.status === 401) {
        handleSignOut()
        throw new Error('Email not authorized for this preview.')
      }
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || 'Preview cap reached. Try again later.')
      }
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

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
                next.push({ ...last, sources: evt.sources, webSearched: evt.webSearched })
                return next
              })
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
        next.push({ ...last, text: `Sorry, something went wrong: ${err.message}` })
        return next
      })
    } finally {
      setStreaming(false)
    }
  }

  const resetChat = () => {
    if (streaming) return
    stopAudio()
    setMessages([])
    setInput('')
    setSuggestedQuestions(sampleThree(QUESTION_POOL))
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:right-auto sm:bottom-6 sm:left-6 z-50 flex flex-col items-start">
      {open && (
        <div className="mb-3 w-full sm:w-[min(480px,calc(100vw-3rem))] bg-white border border-gray-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] rounded-3xl rounded-bl-md overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3 bg-gradient-to-b from-white to-gray-50/60">
            <AmitMonogram size={40} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-display font-black text-[18px] text-[#0a0a0a] tracking-tight leading-none">
                  Ask Amit
                </h3>
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              </div>
              <p className="text-[11px] text-gray-400 leading-tight">
                Dr. Amit Kapoor's digital twin · grounded in his books
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {messages.length > 0 && (
                <button
                  onClick={resetChat}
                  disabled={streaming}
                  className="text-[10px] tracking-[1.5px] uppercase text-gray-400 hover:text-accent transition-colors disabled:opacity-40 font-semibold"
                >
                  New
                </button>
              )}
              <button
                onClick={() => {
                  stopAudio()
                  setOpen(false)
                }}
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-xl leading-none transition-all"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>

          {/* Body */}
          <div
            ref={scrollRef}
            className="px-5 py-5 h-[min(460px,calc(100vh-260px))] overflow-y-auto flex flex-col gap-5 bg-white"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col gap-4 my-auto">
                <div className="text-center">
                  <p className="font-display text-[15px] text-[#0a0a0a] leading-snug mb-1">
                    What would you like to ask?
                  </p>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Competitiveness, social progress, India's economic story.
                  </p>
                </div>
                <div className="flex flex-col gap-2 mt-1">
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInput(q)
                        inputRef.current?.focus()
                      }}
                      className="text-left text-[13px] text-gray-700 bg-gray-50 px-4 py-3 rounded-xl hover:bg-red-50 hover:text-accent transition-all duration-150 border border-gray-100 hover:border-accent/30 hover:shadow-sm leading-snug"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isLastAi = i === messages.length - 1 && msg.role === 'ai'
                const displayText =
                  msg.role === 'ai' ? stripInlineCitations(msg.text) : msg.text
                const uniqueTitles = msg.sources
                  ? Array.from(new Set(msg.sources.map((s) => s.title)))
                  : []
                const canListen = msg.role === 'ai' && !streaming && displayText.length > 10
                const showFollowups =
                  isLastAi && !streaming && uniqueTitles.length > 0 && displayText.length > 10
                const askedSet = new Set(
                  messages
                    .filter((m) => m.role === 'user')
                    .map((m) => m.text.toLowerCase()),
                )
                const followups = showFollowups ? getFollowups(uniqueTitles, askedSet) : []

                return (
                  <div key={i} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {msg.role === 'ai' && (
                      <div className="flex items-center gap-2">
                        <AmitMonogram size={22} />
                        <span className="text-[10px] tracking-[1.5px] uppercase text-gray-400 font-semibold">
                          Amit
                        </span>
                      </div>
                    )}
                    <div
                      className={`text-[14px] px-4 py-3 rounded-2xl leading-[1.6] whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-accent text-white max-w-[85%] rounded-br-md shadow-sm'
                          : 'bg-gray-50 text-gray-800 max-w-[92%] rounded-tl-md border border-gray-100'
                      }`}
                    >
                      {displayText}
                      {isLastAi && streaming && (
                        <span className="inline-flex gap-1 ml-1 align-baseline">
                          <span
                            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: '0ms' }}
                          />
                          <span
                            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: '150ms' }}
                          />
                          <span
                            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: '300ms' }}
                          />
                        </span>
                      )}
                    </div>
                    {canListen && (
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          onClick={() => handleListen(i, displayText)}
                          disabled={loadingIdx === i}
                          className={`flex items-center gap-1.5 text-[10px] tracking-[1.5px] uppercase font-semibold px-3 py-1.5 rounded-full border transition-all ${
                            playingIdx === i
                              ? 'bg-accent text-white border-accent'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-accent hover:text-accent'
                          } disabled:opacity-60`}
                        >
                          {loadingIdx === i ? (
                            <>
                              <SpinnerIcon />
                              <span>Loading</span>
                            </>
                          ) : playingIdx === i ? (
                            <>
                              <StopIcon />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <PlayIcon />
                              <span>Listen</span>
                            </>
                          )}
                        </button>
                        {(uniqueTitles.length > 0 || msg.webSearched) && (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <span className="text-[9px] text-gray-400 tracking-[1.5px] uppercase font-semibold">
                              From
                            </span>
                            {uniqueTitles.map((t, j) => (
                              <span
                                key={j}
                                className="text-[10px] text-gray-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full"
                              >
                                {t}
                              </span>
                            ))}
                            {msg.webSearched && (
                              <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <circle cx="11" cy="11" r="8" />
                                  <path d="m21 21-4.35-4.35" />
                                </svg>
                                Web
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {showFollowups && followups.length > 0 && (
                      <div className="flex flex-col gap-1.5 pt-2 w-full">
                        <span className="text-[9px] text-gray-400 tracking-[1.5px] uppercase font-semibold">
                          Follow up
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {followups.map((q, k) => (
                            <button
                              key={k}
                              onClick={() => {
                                setInput(q)
                                inputRef.current?.focus()
                              }}
                              className="text-left text-[12px] text-gray-700 bg-gray-50 px-3 py-1.5 rounded-full hover:bg-red-50 hover:text-accent transition-all border border-gray-200 hover:border-accent/30"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Input or email gate */}
          {userEmail ? (
            <div className="flex flex-col border-t border-gray-100 bg-gradient-to-b from-gray-50/30 to-gray-50/60">
              <div className="px-5 pt-2.5 pb-0.5 flex items-center justify-between">
                <span className="text-[10px] text-gray-400 tracking-wide truncate max-w-[70%]">
                  Access as {userEmail}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-[10px] tracking-[1.5px] uppercase text-gray-400 hover:text-accent transition-colors font-semibold"
                >
                  Change
                </button>
              </div>
              <div className="px-5 py-3 flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={streaming ? 'Amit is thinking...' : 'Ask a question...'}
                  disabled={streaming}
                  className="flex-1 min-w-0 text-[16px] sm:text-[13px] border border-gray-200 px-4 py-3 rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all placeholder:text-gray-400 disabled:bg-gray-100 bg-white"
                />
                <button
                  onClick={handleSend}
                  disabled={streaming || !input.trim()}
                  className="bg-accent text-white px-4 py-3 rounded-xl hover:bg-[#0a0a0a] transition-all font-bold disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow-md flex items-center justify-center"
                  aria-label="Send"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="px-5 py-6 border-t border-gray-100 bg-gradient-to-b from-gray-50/30 to-gray-50/60 flex flex-col items-center gap-3">
              <p className="text-[12px] text-gray-500 text-center leading-relaxed max-w-[300px]">
                Private preview. Enter the email your link was sent to.
              </p>
              <div className="flex gap-2 w-full">
                <input
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value)
                    if (emailError) setEmailError(null)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                  className="flex-1 min-w-0 text-[16px] sm:text-[13px] border border-gray-200 px-4 py-3 rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 placeholder:text-gray-400 bg-white"
                />
                <button
                  onClick={handleEmailSubmit}
                  disabled={!emailInput.trim()}
                  className="bg-accent text-white px-4 py-3 rounded-xl hover:bg-[#0a0a0a] transition-all font-bold disabled:opacity-40 disabled:cursor-not-allowed text-[12px] tracking-wider uppercase"
                >
                  Enter
                </button>
              </div>
              {emailError && (
                <p className="text-[11px] text-accent leading-tight">{emailError}</p>
              )}
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 text-[11px] tracking-[1.5px] uppercase px-5 py-3 shadow-xl transition-all duration-200 rounded-full font-semibold ${
          open
            ? 'bg-accent text-white scale-95'
            : 'bg-white border border-accent text-accent hover:bg-accent hover:text-white hover:scale-105'
        }`}
      >
        <AmitMonogram size={20} />
        <span>Ask Amit</span>
      </button>
    </div>
  )
}

export default function VoiceWidget() {
  return <AskAmitWidget />
}
