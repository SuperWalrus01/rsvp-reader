/** Library entry — metadata only, the token stream lives in a separate store. */
export interface DocMeta {
  id: string
  title: string
  author: string
  totalWords: number
  /** Index of the last-read token, so reopening resumes exactly here. */
  position: number
  addedAt: number
  lastReadAt: number
}

/** One reading sitting (play → pause). Phase 2 stats are computed from these. */
export interface Session {
  id: string
  /** Local calendar date, YYYY-MM-DD (for streaks). */
  date: string
  startedAt: number
  wordsRead: number
  durationMs: number
  /** Actual achieved WPM for the sitting (words / minutes). */
  wpm: number
}

export interface Settings {
  wpm: number
  smartTiming: boolean
  pauseMultiplier: number
  theme: 'dark' | 'light'
  fontSize: 's' | 'm' | 'l' | 'xl'
  fontFamily: 'sans' | 'serif'
}

export const DEFAULT_SETTINGS: Settings = {
  wpm: 300,
  smartTiming: true,
  pauseMultiplier: 1,
  theme: 'dark',
  fontSize: 'l',
  fontFamily: 'sans',
}

export interface ParsedDoc {
  title: string
  author: string
  text: string
}
