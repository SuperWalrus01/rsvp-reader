import { useEffect, useState } from 'react'
import type { Session } from '../types'
import { listSessions } from '../db'

/**
 * Phase 2 — honest local stats computed from stored session records:
 * total words, average/current WPM, day streak, and a WPM-over-time chart.
 */
export function Stats({ onBack }: { onBack: () => void }) {
  const [sessions, setSessions] = useState<Session[] | null>(null)
  useEffect(() => {
    void listSessions().then(setSessions)
  }, [])

  if (sessions === null) return <div className="h-full bg-white dark:bg-[#0b1220]" />

  const totalWords = sessions.reduce((n, s) => n + s.wordsRead, 0)
  const totalMs = sessions.reduce((n, s) => n + s.durationMs, 0)
  const avgWpm = totalMs > 0 ? Math.round(totalWords / (totalMs / 60000)) : 0
  const lastWpm = sessions.length > 0 ? sessions[sessions.length - 1].wpm : 0
  const streak = calcStreak(new Set(sessions.map((s) => s.date)))

  return (
    <div
      className="flex h-full flex-col bg-white text-slate-900 dark:bg-[#0b1220] dark:text-slate-100"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="flex items-center gap-2 px-3 pt-4 pb-2">
        <button
          onClick={onBack}
          aria-label="Back to library"
          className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 active:bg-slate-200 dark:active:bg-slate-700"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold">Stats</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-[env(safe-area-inset-bottom)]">
        {sessions.length === 0 ? (
          <div className="mt-16 text-center text-slate-400 dark:text-slate-500">
            <p className="text-4xl">📈</p>
            <p className="mt-3">No sessions yet — go read something.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Words read" value={totalWords.toLocaleString()} />
              <StatCard label="Day streak" value={`${streak}${streak > 0 ? ' 🔥' : ''}`} />
              <StatCard label="Average WPM" value={String(avgWpm)} />
              <StatCard label="Last session WPM" value={String(lastWpm)} />
              <StatCard label="Sessions" value={String(sessions.length)} />
              <StatCard label="Time reading" value={formatDuration(totalMs)} />
            </div>

            <h2 className="mt-6 mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
              WPM over time (last {Math.min(30, sessions.length)} sessions)
            </h2>
            <WpmChart sessions={sessions.slice(-30)} />
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 dark:bg-[#101a2e]">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  )
}

/** Days-with-a-session streak ending today (or yesterday, so it isn't lost mid-day). */
function calcStreak(days: Set<string>): number {
  const d = new Date()
  const key = () =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (!days.has(key())) d.setDate(d.getDate() - 1) // allow "haven't read yet today"
  let streak = 0
  while (days.has(key())) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min}m`
  return `${Math.floor(min / 60)}h ${min % 60}m`
}

function WpmChart({ sessions }: { sessions: Session[] }) {
  const W = 320
  const H = 120
  const PAD = 8
  const wpms = sessions.map((s) => s.wpm)
  const max = Math.max(...wpms, 100)
  const min = Math.min(...wpms, max - 50)
  const x = (i: number) =>
    sessions.length === 1 ? W / 2 : PAD + (i / (sessions.length - 1)) * (W - 2 * PAD)
  const y = (wpm: number) => H - PAD - ((wpm - min) / (max - min || 1)) * (H - 2 * PAD)
  const points = sessions.map((s, i) => `${x(i).toFixed(1)},${y(s.wpm).toFixed(1)}`).join(' ')

  return (
    <div className="rounded-xl bg-slate-50 p-4 dark:bg-[#101a2e]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <polyline
          points={points}
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {sessions.map((s, i) => (
          <circle key={s.id} cx={x(i)} cy={y(s.wpm)} r="3" fill="#ef4444" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{min} wpm</span>
        <span>{max} wpm</span>
      </div>
    </div>
  )
}
