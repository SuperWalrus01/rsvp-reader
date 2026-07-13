/**
 * Turn plain text into the RSVP token stream.
 *
 * A token is a single word. The last word of a paragraph carries a trailing
 * '\n' marker so the timing engine can insert a paragraph pause; the marker
 * is stripped before display.
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = []
  // Paragraph = block separated by one-or-more blank lines.
  const paragraphs = text.split(/\n\s*\n+/)
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) continue
    for (const w of words) tokens.push(w)
    tokens[tokens.length - 1] += '\n'
  }
  return tokens
}

/** The display form of a token (paragraph marker stripped). */
export function tokenWord(token: string): string {
  return token.endsWith('\n') ? token.slice(0, -1) : token
}

export function isParagraphEnd(token: string): boolean {
  return token.endsWith('\n')
}
