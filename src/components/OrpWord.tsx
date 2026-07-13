import { useLayoutEffect, useRef } from 'react'
import { orpIndex } from '../orp'

/**
 * Renders one word with its ORP pivot letter locked to a fixed horizontal
 * anchor. The parent places this component's origin at the anchor; after
 * render we measure the prefix and pivot widths and shift the word left so
 * the pivot's *centre* sits exactly on the anchor — regardless of word
 * length or font. The pivot is drawn in the accent colour.
 */
export function OrpWord({ word, fontSizePx, serif }: {
  word: string
  fontSizePx: number
  serif: boolean
}) {
  const p = orpIndex(word.length)
  const innerRef = useRef<HTMLDivElement>(null)
  const preRef = useRef<HTMLSpanElement>(null)
  const pivotRef = useRef<HTMLSpanElement>(null)

  // Shrink very long words so they still fit a phone screen.
  const size = word.length > 14 ? fontSizePx * 0.72 : word.length > 10 ? fontSizePx * 0.85 : fontSizePx

  useLayoutEffect(() => {
    const pre = preRef.current?.getBoundingClientRect().width ?? 0
    const pivot = pivotRef.current?.getBoundingClientRect().width ?? 0
    if (innerRef.current) {
      innerRef.current.style.transform = `translateX(${-(pre + pivot / 2)}px)`
    }
  }, [word, size, serif])

  return (
    <div
      ref={innerRef}
      className="whitespace-pre leading-none font-medium"
      style={{
        fontSize: size,
        fontFamily: serif ? "Georgia, 'Times New Roman', serif" : 'inherit',
      }}
    >
      <span ref={preRef}>{word.slice(0, p)}</span>
      <span ref={pivotRef} className="text-accent">{word[p] ?? ''}</span>
      <span>{word.slice(p + 1)}</span>
    </div>
  )
}
