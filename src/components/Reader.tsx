import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocMeta, Settings } from '../types'
import { getTokens, savePosition, saveSession } from '../db'
import { delayForToken, estimateRemainingMs } from '../timing'
import { tokenWord } from '../tokenize'
import { useWakeLock } from '../hooks/useWakeLock'
import { OrpWord } from './OrpWord'
import { SettingsSheet } from './SettingsSheet'

const ANCHOR = '38%' // fixed horizontal anchor the ORP pivot locks onto
const FONT_PX = { s: 32, m: 40, l: 48, xl: 58 } as const

export function Reader({ doc, settings, updateSettings, onBack }: {
  doc: DocMeta
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  onBack: () => void
}) {
  const [tokens, setTokens] = useState<string[] | null>(null)
  const [index, setIndex] = useState(doc.position)
  const [playing, setPlaying] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useWakeLock(playing)

  useEffect(() => {
    let alive = true
    getTokens(doc.id).then((t) => {
      if (alive) setTokens(t)
    })
    return () => {
      alive = false
    }
  }, [doc.id])

  const total = tokens?.length ?? doc.totalWords
  const clamp = useCallback(
    (i: number) => Math.max(0, Math.min(total - 1, i)),
    [total],
  )

  // ----- playback loop: one timeout per word, delay from the timing engine
  useEffect(() => {
    if (!playing || !tokens || tokens.length === 0) return
    const delay = delayForToken(tokens[index], settings.wpm, settings)
    const t = setTimeout(() => {
      wordsThisSession.current += 1
      if (index + 1 >= tokens.length) setPlayingTracked(false)
      else setIndex(index + 1)
    }, delay)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only timing-relevant settings
  }, [playing, index, tokens, settings.wpm, settings.smartTiming, settings.pauseMultiplier])

  // ----- session tracking (Phase 2): one session per play→pause sitting
  const wordsThisSession = useRef(0)
  const sessionStart = useRef(0)
  const flushSession = useCallback(() => {
    const words = wordsThisSession.current
    const durationMs = Date.now() - sessionStart.current
    wordsThisSession.current = 0
    if (words < 5 || durationMs < 2000) return
    const d = new Date()
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    void saveSession({
      id: crypto.randomUUID(),
      date,
      startedAt: sessionStart.current,
      wordsRead: words,
      durationMs,
      wpm: Math.round(words / (durationMs / 60000)),
    })
  }, [])

  const setPlayingTracked = useCallback(
    (next: boolean) => {
      setPlaying((prev) => {
        if (!prev && next) {
          sessionStart.current = Date.now()
          wordsThisSession.current = 0
        }
        if (prev && !next) flushSession()
        return next
      })
    },
    [flushSession],
  )
  const flushRef = useRef(flushSession)
  flushRef.current = flushSession

  // ----- persist position: throttled while reading, always on pause/leave
  const indexRef = useRef(index)
  indexRef.current = index
  const playingRef = useRef(playing)
  playingRef.current = playing
  const lastSaved = useRef(0)
  useEffect(() => {
    if (Date.now() - lastSaved.current > 1500) {
      lastSaved.current = Date.now()
      void savePosition(doc.id, index)
    }
  }, [index, doc.id])
  useEffect(() => {
    const persist = () => void savePosition(doc.id, indexRef.current)
    const onHide = () => {
      if (document.visibilityState === 'hidden') persist()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      persist() // unmount (back to library, etc.)
      if (playingRef.current) flushRef.current() // save an in-progress sitting
    }
  }, [doc.id])
  useEffect(() => {
    if (!playing) void savePosition(doc.id, indexRef.current)
  }, [playing, doc.id])

  // ----- gestures: tap = play/pause, horizontal swipe = scrub
  const gesture = useRef<{
    x: number
    startIndex: number
    moved: boolean
    wasPlaying: boolean
  } | null>(null)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    gesture.current = { x: e.clientX, startIndex: index, moved: false, wasPlaying: playing }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    const dx = e.clientX - g.x
    if (!g.moved && Math.abs(dx) > 12) {
      g.moved = true
      if (playing) setPlayingTracked(false)
    }
    if (g.moved) setIndex(clamp(g.startIndex + Math.round(dx / 9))) // drag right = forward
  }
  const onPointerUp = () => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (!g.moved) setPlayingTracked(!playing)
    else if (g.wasPlaying) setPlayingTracked(true)
  }

  // ----- keyboard (laptop nicety): space play/pause, ←/→ seek, ↑/↓ speed
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        setPlayingTracked(!playing)
      } else if (e.key === 'ArrowLeft') setIndex((i) => clamp(i - 10))
      else if (e.key === 'ArrowRight') setIndex((i) => clamp(i + 10))
      else if (e.key === 'ArrowUp') updateSettings({ wpm: Math.min(1000, settings.wpm + 25) })
      else if (e.key === 'ArrowDown') updateSettings({ wpm: Math.max(100, settings.wpm - 25) })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, settings.wpm, clamp, setPlayingTracked, updateSettings])

  if (tokens && tokens.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-white text-slate-900 dark:bg-[#0b1220] dark:text-slate-100">
        <p>This document has no readable text.</p>
        <button onClick={onBack} className="rounded-lg bg-accent px-5 py-3 text-white">
          Back to library
        </button>
      </div>
    )
  }

  const word = tokens ? tokenWord(tokens[index] ?? '') : ''
  const remaining = estimateRemainingMs(total - index, settings.wpm, settings.smartTiming)
  const finished = tokens !== null && index >= total - 1 && !playing

  return (
    <div className="flex h-full flex-col bg-white text-slate-900 select-none dark:bg-[#0b1220] dark:text-slate-100">
      {/* ---- reading surface: the whole zone is the play/pause tap target */}
      <div
        className="relative flex-1 cursor-pointer"
        style={{ touchAction: 'none', paddingTop: 'env(safe-area-inset-top)' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* static guide ticks above/below the anchor so the eye locks on */}
        <div
          className="absolute top-[calc(50%-3.2em)] h-5 w-0.5 -translate-x-1/2 bg-slate-300 dark:bg-slate-600"
          style={{ left: ANCHOR }}
        />
        <div
          className="absolute top-[calc(50%+2.2em)] h-5 w-0.5 -translate-x-1/2 bg-slate-300 dark:bg-slate-600"
          style={{ left: ANCHOR }}
        />

        {/* the word, pivot pinned to the anchor */}
        <div className="absolute top-1/2 -translate-y-1/2" style={{ left: ANCHOR }}>
          {tokens === null ? (
            <div className="-translate-x-1/2 text-slate-400">Loading…</div>
          ) : (
            <OrpWord
              word={word}
              fontSizePx={FONT_PX[settings.fontSize]}
              serif={settings.fontFamily === 'serif'}
            />
          )}
        </div>

        {/* paused hint, kept away from the word */}
        {!playing && tokens !== null && (
          <div className="absolute inset-x-0 bottom-8 text-center text-sm text-slate-400 dark:text-slate-500">
            {finished ? 'Finished — tap restart to read again' : 'Tap to play · swipe to scrub'}
          </div>
        )}
      </div>

      {/* ---- bottom bar: everything within thumb reach, above home indicator */}
      <div
        className="border-t border-slate-200 bg-slate-50 px-4 pt-2 dark:border-slate-800 dark:bg-[#0e1628]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
      >
        <input
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={index}
          onChange={(e) => setIndex(clamp(Number(e.target.value)))}
          className="w-full"
          aria-label="Reading position"
        />
        <div className="flex items-baseline justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            word {(index + 1).toLocaleString()} / {total.toLocaleString()}
          </span>
          <span>{formatEta(remaining)} left</span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <IconButton label="Back to library" onClick={onBack}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </IconButton>
          <IconButton
            label="Restart"
            onClick={() => {
              setPlayingTracked(false)
              setIndex(0)
            }}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </IconButton>

          <div className="flex items-center gap-1">
            <IconButton
              label="Slower"
              onClick={() => updateSettings({ wpm: Math.max(100, settings.wpm - 25) })}
            >
              <span className="text-2xl leading-none">−</span>
            </IconButton>
            <div className="w-16 text-center">
              <div className="text-lg leading-tight font-semibold tabular-nums">{settings.wpm}</div>
              <div className="text-[10px] tracking-wide text-slate-500 uppercase dark:text-slate-400">wpm</div>
            </div>
            <IconButton
              label="Faster"
              onClick={() => updateSettings({ wpm: Math.min(1000, settings.wpm + 25) })}
            >
              <span className="text-2xl leading-none">+</span>
            </IconButton>
          </div>

          <IconButton label="Play or pause" onClick={() => setPlayingTracked(!playing)} accent>
            {playing ? (
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            )}
          </IconButton>
          <IconButton label="Settings" onClick={() => setShowSettings(true)}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.6 1.6 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.82-.33 1.6 1.6 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.6 1.6 0 0 0-1-1.51 1.6 1.6 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .33-1.82 1.6 1.6 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.6 1.6 0 0 0 1.51-1 1.6 1.6 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.82.33h.09a1.6 1.6 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.6 1.6 0 0 0 1 1.51 1.6 1.6 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.33 1.82v.09a1.6 1.6 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.6 1.6 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </IconButton>
        </div>
      </div>

      {showSettings && (
        <SettingsSheet
          settings={settings}
          updateSettings={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

function IconButton({ label, onClick, accent, children }: {
  label: string
  onClick: () => void
  accent?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95 ${
        accent
          ? 'bg-accent text-white'
          : 'text-slate-600 active:bg-slate-200 dark:text-slate-300 dark:active:bg-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

function formatEta(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000))
  if (totalSec >= 3600) {
    const h = Math.floor(totalSec / 3600)
    const m = Math.round((totalSec % 3600) / 60)
    return `${h}h ${m}m`
  }
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
