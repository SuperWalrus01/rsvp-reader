import { isParagraphEnd, tokenWord } from './tokenize'

export interface TimingOptions {
  smartTiming: boolean
  /** Scales only the *extra* pause portions (punctuation / paragraphs). 1 = default. */
  pauseMultiplier: number
}

/**
 * How long a token stays on screen, in milliseconds.
 *
 * Base delay is 60000 / WPM. With smart timing on, modifiers are added so the
 * cadence matches how you'd naturally read:
 *
 *  - Long words get extra time: +5% of base per character beyond 6, capped
 *    at +50%, because long words take longer to recognise.
 *  - Sentence-ending punctuation (. ! ? …) adds a long pause (+140% of base).
 *  - Clause punctuation (, ; : — dashes) adds a short pause (+60% of base).
 *  - A paragraph break adds a clear beat (+160% of base) so sections feel
 *    distinct rather than running together.
 *
 * All pause bonuses (not the long-word bonus) are scaled by `pauseMultiplier`
 * so their strength is tunable from settings.
 */
export function delayForToken(token: string, wpm: number, opts: TimingOptions): number {
  const base = 60000 / wpm
  if (!opts.smartTiming) return base

  const word = tokenWord(token)
  let factor = 1

  // Long-word bonus — count only letters/digits so "word," isn't penalised.
  const letters = word.replace(/[^\p{L}\p{N}]/gu, '').length
  if (letters > 6) factor += Math.min(0.5, (letters - 6) * 0.05)

  // Punctuation pauses. Allow a closing quote/bracket after the mark.
  const pm = opts.pauseMultiplier
  if (/[.!?…]["”'’)\]]*$/.test(word)) factor += 1.4 * pm
  else if (/[,;:—–]["”'’)\]]*$/.test(word)) factor += 0.6 * pm

  if (isParagraphEnd(token)) factor += 1.6 * pm

  return base * factor
}

/** Rough remaining-time estimate; smart timing averages out ~12% slower. */
export function estimateRemainingMs(
  wordsLeft: number,
  wpm: number,
  smartTiming: boolean,
): number {
  return wordsLeft * (60000 / wpm) * (smartTiming ? 1.12 : 1)
}
