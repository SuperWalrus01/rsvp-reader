import JSZip from 'jszip'
import type { ParsedDoc } from '../types'

/**
 * EPUB import: unzip, read the OPF spine for correct reading order, convert
 * each XHTML document to plain text (preserving paragraph breaks), and
 * concatenate. Metadata (title/author) comes from the OPF.
 */
export async function parseEpub(file: File): Promise<ParsedDoc> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())

  // 1. META-INF/container.xml points at the OPF package file.
  const containerXml = await readZipText(zip, 'META-INF/container.xml')
  if (!containerXml) throw new Error('Not a valid EPUB (missing container.xml)')
  const container = parseXml(containerXml)
  const opfPath = container.querySelector('rootfile')?.getAttribute('full-path')
  if (!opfPath) throw new Error('Not a valid EPUB (no rootfile)')

  const opfXml = await readZipText(zip, opfPath)
  if (!opfXml) throw new Error('Not a valid EPUB (missing OPF)')
  const opf = parseXml(opfXml)
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''

  // 2. Metadata.
  const title =
    firstText(opf, 'title') || file.name.replace(/\.epub$/i, '') || 'Untitled'
  const author = firstText(opf, 'creator')

  // 3. Manifest: id → href, so spine itemrefs can be resolved.
  const manifest = new Map<string, { href: string; type: string }>()
  for (const item of Array.from(opf.getElementsByTagName('item'))) {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    if (id && href)
      manifest.set(id, { href, type: item.getAttribute('media-type') ?? '' })
  }

  // 4. Walk the spine in order and extract text from each XHTML chapter.
  const parts: string[] = []
  for (const itemref of Array.from(opf.getElementsByTagName('itemref'))) {
    const idref = itemref.getAttribute('idref')
    const item = idref ? manifest.get(idref) : undefined
    if (!item || (item.type && !/html|xml/i.test(item.type))) continue
    const html = await readZipText(zip, resolvePath(opfDir, item.href))
    if (html) parts.push(htmlToText(html))
  }

  const text = parts.join('\n\n')
  if (!text.trim()) throw new Error('No readable text found in this EPUB')
  return { title, author, text }
}

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml')
}

/** First matching element's text, namespace-agnostic (dc:title etc.). */
function firstText(doc: Document, localName: string): string {
  const el = doc.getElementsByTagNameNS('*', localName)[0]
  return el?.textContent?.trim() ?? ''
}

/** Resolve an href relative to the OPF directory, handling ../ and %20. */
function resolvePath(baseDir: string, href: string): string {
  const clean = decodeURIComponent(href.split('#')[0])
  const segments = (baseDir + clean).split('/')
  const out: string[] = []
  for (const seg of segments) {
    if (seg === '..') out.pop()
    else if (seg !== '.' && seg !== '') out.push(seg)
  }
  return out.join('/')
}

async function readZipText(zip: JSZip, path: string): Promise<string | null> {
  const entry = zip.file(path) ?? zip.file(decodeURIComponent(path))
  return entry ? entry.async('string') : null
}

const BLOCK_TAGS = new Set([
  'P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'ASIDE', 'MAIN',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'UL', 'OL', 'DL', 'DT', 'DD',
  'BLOCKQUOTE', 'PRE', 'FIGURE', 'FIGCAPTION', 'TABLE', 'TR', 'TD', 'TH',
  'BR', 'HR',
])
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'HEAD', 'TITLE', 'SVG', 'IMG', 'NAV'])
// Body-text blocks whose fragments may be rejoined into one logical paragraph.
const FLOW_TAGS = new Set(['P', 'DIV'])

interface Block {
  tag: string
  text: string
}

/**
 * Convert a chapter's XHTML to plain text, one paragraph per *logical*
 * paragraph of the original book.
 *
 * Many EPUBs — especially ones converted from PDF or print — split a single
 * paragraph across several <p> elements, one per printed line. Treating every
 * block as a hard paragraph break would then chop sentences into one-line
 * fragments. So we rejoin a block onto the previous one when the previous
 * block didn't end a sentence and this one continues in lower case, which
 * reconstructs the paragraphs while leaving headings, list items and
 * genuinely new paragraphs untouched.
 */
export function htmlToText(html: string): string {
  let doc = new DOMParser().parseFromString(html, 'application/xhtml+xml')
  if (doc.querySelector('parsererror')) {
    doc = new DOMParser().parseFromString(html, 'text/html')
  }
  const blocks: Block[] = []
  collectBlocks(doc.body ?? doc.documentElement, blocks)
  return mergeFragments(blocks)
    .map((b) => b.text)
    .join('\n\n')
}

/** Flatten the DOM into text blocks, one per block-level element. */
function collectBlocks(root: Node | null, blocks: Block[]) {
  let buf: string[] = []
  let bufTag: string | null = null
  const flush = () => {
    const text = buf.join('').replace(/\s+/g, ' ').trim()
    if (text) blocks.push({ tag: bufTag ?? 'P', text })
    buf = []
    bufTag = null
  }
  const walk = (node: Node | null, blockTag: string) => {
    if (!node) return
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent
      if (t) {
        if (buf.length === 0) bufTag = blockTag
        buf.push(t)
      }
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const tag = (node as Element).tagName.toUpperCase()
    if (SKIP_TAGS.has(tag)) return
    if (BLOCK_TAGS.has(tag)) {
      flush()
      for (const child of Array.from(node.childNodes)) walk(child, tag)
      flush()
    } else {
      for (const child of Array.from(node.childNodes)) walk(child, blockTag)
    }
  }
  walk(root, 'P')
  flush()
}

/** True if the text ends a sentence, so the next block is a new paragraph. */
function endsSentence(text: string): boolean {
  return /[.!?…:;)"'”’»\]]\s*$/.test(text)
}

/** Rejoin print-reflow line fragments back into whole paragraphs. */
function mergeFragments(blocks: Block[]): Block[] {
  const out: Block[] = []
  for (const b of blocks) {
    const prev = out[out.length - 1]
    if (
      prev &&
      FLOW_TAGS.has(prev.tag) &&
      FLOW_TAGS.has(b.tag) &&
      !endsSentence(prev.text) &&
      /^\p{Ll}/u.test(b.text)
    ) {
      prev.text += ' ' + b.text
    } else {
      out.push({ ...b })
    }
  }
  return out
}
