import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { ParsedDoc } from '../types'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/**
 * PDF import (best-effort — PDFs carry layout, not structure):
 *  - extract text lines per page with pdf.js
 *  - strip repeated headers/footers and bare page numbers
 *  - de-hyphenate words split across line breaks ("exam-\nple" → "example")
 *  - collapse hard line breaks inside paragraphs into spaces, keeping a
 *    paragraph break where a line clearly ends one (short line + end punctuation)
 */
export async function parsePdf(file: File): Promise<ParsedDoc> {
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise

  const meta = (await pdf.getMetadata().catch(() => null))?.info as
    | { Title?: string; Author?: string }
    | undefined
  const title = meta?.Title?.trim() || file.name.replace(/\.pdf$/i, '')
  const author = meta?.Author?.trim() ?? ''

  // 1. Collect lines per page. pdf.js marks line ends with hasEOL.
  const pages: string[][] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const lines: string[] = []
    let current = ''
    for (const item of content.items) {
      if (!('str' in item)) continue
      current += item.str
      if (item.hasEOL) {
        lines.push(current.trim())
        current = ''
      } else if (item.str && !item.str.endsWith(' ')) {
        current += ' '
      }
    }
    if (current.trim()) lines.push(current.trim())
    pages.push(lines.filter((l) => l.length > 0))
  }
  pdf.destroy()

  // 2. Find repeated headers/footers: normalise digits so "Page 12" and
  //    "Page 13" count as the same line, then drop lines that appear at the
  //    top/bottom of a large share of pages.
  const normalize = (s: string) => s.replace(/\d+/g, '#').toLowerCase().trim()
  const edgeCounts = new Map<string, number>()
  for (const lines of pages) {
    for (const edge of new Set([lines[0], lines[lines.length - 1]])) {
      if (edge !== undefined)
        edgeCounts.set(normalize(edge), (edgeCounts.get(normalize(edge)) ?? 0) + 1)
    }
  }
  const threshold = Math.max(3, pages.length * 0.4)
  const isBoilerplate = (line: string, i: number, lines: string[]) =>
    /^\s*[\divxlc]+\s*$/i.test(line) || // bare page number (arabic or roman)
    ((i === 0 || i === lines.length - 1) && (edgeCounts.get(normalize(line)) ?? 0) >= threshold)

  const allLines: string[] = []
  for (const lines of pages) {
    for (let i = 0; i < lines.length; i++) {
      if (!isBoilerplate(lines[i], i, lines)) allLines.push(lines[i])
    }
  }

  // 3. Rebuild paragraphs from lines.
  const lengths = allLines.map((l) => l.length).sort((a, b) => a - b)
  const medianLen = lengths[Math.floor(lengths.length / 2)] ?? 60
  let text = ''
  let prevLineLen = 0
  for (const line of allLines) {
    if (!text) {
      text = line
    } else if (/[\p{L}\p{N}][-­]$/u.test(text)) {
      // De-hyphenate a word split across the line break.
      text = text.replace(/[-­]$/u, '') + line
    } else if (/[.!?…:]["”'’)\]]*$/.test(text) && prevLineLen < medianLen * 0.75) {
      // Previous line was short and ended a sentence → paragraph break.
      text += '\n\n' + line
    } else {
      text += ' ' + line
    }
    prevLineLen = line.length
  }

  if (!text.trim()) throw new Error('No selectable text in this PDF (it may be scanned images)')
  return { title, author, text }
}
