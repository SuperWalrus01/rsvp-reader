import type { ParsedDoc } from '../types'

/**
 * Route a picked file to the right parser. EPUB/PDF parsers are loaded
 * lazily so the app shell stays small (pdf.js in particular is heavy);
 * both chunks are still precached by the service worker for offline use.
 */
export async function parseFile(file: File): Promise<ParsedDoc> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.epub') || file.type === 'application/epub+zip') {
    const { parseEpub } = await import('./epub')
    return parseEpub(file)
  }
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const { parsePdf } = await import('./pdf')
    return parsePdf(file)
  }
  if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) {
    const text = await file.text()
    if (!text.trim()) throw new Error('That file is empty')
    return { title: file.name.replace(/\.(txt|md)$/i, ''), author: '', text }
  }
  throw new Error(`Unsupported file type: ${file.name}. Use EPUB, PDF or TXT.`)
}
