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

/** Strip tags, inserting paragraph breaks at block-element boundaries. */
export function htmlToText(html: string): string {
  let doc = new DOMParser().parseFromString(html, 'application/xhtml+xml')
  if (doc.querySelector('parsererror')) {
    doc = new DOMParser().parseFromString(html, 'text/html')
  }
  const out: string[] = []
  walk(doc.body ?? doc.documentElement, out)
  return out
    .join('')
    .replace(/[ \t\r]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{2,}/g, '\n\n')
    .trim()
}

function walk(node: Node | null, out: string[]) {
  if (!node) return
  if (node.nodeType === Node.TEXT_NODE) {
    out.push(node.textContent ?? '')
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const tag = (node as Element).tagName.toUpperCase()
  if (SKIP_TAGS.has(tag)) return
  const block = BLOCK_TAGS.has(tag)
  if (block) out.push('\n\n')
  for (const child of Array.from(node.childNodes)) walk(child, out)
  if (block) out.push('\n\n')
}
