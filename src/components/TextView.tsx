import { useEffect, useMemo, useRef } from 'react'
import { tokenWord } from '../tokenize'

interface Para {
  start: number // global token index of the paragraph's first word
  words: string[]
}

/**
 * Full-text "paragraph view": shows the whole document as normal flowing
 * paragraphs so you can see where you've read up to and jump around.
 *
 *  - Already-read text is muted, upcoming text is prominent, and the current
 *    word is highlighted — so the read/unread boundary is obvious at a glance.
 *  - Tap any word (or paragraph) to move the RSVP reader there — skip forward
 *    or back to exactly that spot.
 *
 * Only the paragraph containing the current word is split into per-word spans;
 * every other paragraph renders as a single element, so this stays fast even
 * for full-length books.
 */
export function TextView({ tokens, index, serif, onJump, onClose }: {
  tokens: string[]
  index: number
  serif: boolean
  onJump: (i: number) => void
  onClose: () => void
}) {
  const paragraphs = useMemo<Para[]>(() => {
    const out: Para[] = []
    let start = 0
    let words: string[] = []
    for (let i = 0; i < tokens.length; i++) {
      words.push(tokenWord(tokens[i]))
      if (tokens[i].endsWith('\n') || i === tokens.length - 1) {
        out.push({ start, words })
        start = i + 1
        words = []
      }
    }
    return out
  }, [tokens])

  // Below this size, make every word individually tappable (exact jumps).
  // Above it (full books), only the current paragraph is split into words and
  // other paragraphs jump to their start, so we never render 100k spans.
  const wordLevel = tokens.length <= 8000

  const currentRef = useRef<HTMLSpanElement | null>(null)
  const scrollToCurrent = () =>
    currentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })

  // Centre the current word when the view opens.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-white text-slate-900 dark:bg-[#0b1220] dark:text-slate-100"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          Tap any word to jump there
        </span>
        <button
          onClick={onClose}
          aria-label="Close text view"
          className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 active:bg-slate-200 dark:active:bg-slate-700"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div
        className="flex-1 overflow-y-auto px-5 py-4"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
          fontFamily: serif ? "Georgia, 'Times New Roman', serif" : 'inherit',
          fontSize: 18,
          lineHeight: 1.85,
        }}
      >
        {paragraphs.map((p) => (
          <Paragraph
            key={p.start}
            p={p}
            index={index}
            wordLevel={wordLevel}
            onJump={onJump}
            currentRef={currentRef}
          />
        ))}
      </div>

      {/* jump back to where you are, if you've scrolled off */}
      <button
        onClick={scrollToCurrent}
        aria-label="Scroll to current position"
        className="absolute right-4 flex h-12 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-white shadow-lg active:opacity-80"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M12 16l-6-6h12z" />
        </svg>
        Current
      </button>
    </div>
  )
}

const READ = 'text-slate-400 dark:text-slate-600'
const UNREAD = 'text-slate-900 dark:text-slate-100'

function Paragraph({ p, index, wordLevel, onJump, currentRef }: {
  p: Para
  index: number
  wordLevel: boolean
  onJump: (i: number) => void
  currentRef: React.RefObject<HTMLSpanElement | null>
}) {
  const end = p.start + p.words.length - 1
  const isCurrent = index >= p.start && index <= end

  // Big-book fast path: non-current paragraphs render as a single element and
  // jump to their start when tapped.
  if (!isCurrent && !wordLevel) {
    return (
      <p
        onClick={() => onJump(p.start)}
        className={`mb-4 cursor-pointer ${index > end ? READ : UNREAD}`}
      >
        {p.words.join(' ')}
      </p>
    )
  }

  // Per-word spans so each word is an exact jump target. Only the current
  // paragraph needs windowing (a giant break-less paragraph could be huge);
  // other paragraphs here are bounded by the wordLevel size cap.
  let from = 0
  let to = p.words.length
  if (isCurrent && p.words.length > 1000) {
    from = Math.max(0, index - p.start - 500)
    to = Math.min(p.words.length, index - p.start + 500)
  }

  return (
    <p className="mb-4">
      {from > 0 && (
        <span onClick={() => onJump(p.start)} className={`cursor-pointer ${READ}`}>
          {p.words.slice(0, from).join(' ')}{' '}
        </span>
      )}
      {p.words.slice(from, to).map((w, i) => {
        const gi = p.start + from + i
        const current = gi === index
        return (
          <span
            key={gi}
            ref={current ? currentRef : undefined}
            onClick={() => onJump(gi)}
            className={
              current
                ? 'cursor-pointer rounded bg-accent px-1 text-white'
                : `cursor-pointer ${gi < index ? READ : UNREAD}`
            }
          >
            {w}{' '}
          </span>
        )
      })}
      {to < p.words.length && (
        <span onClick={() => onJump(p.start + to)} className={`cursor-pointer ${UNREAD}`}>
          {p.words.slice(to).join(' ')}
        </span>
      )}
    </p>
  )
}
