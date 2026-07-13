import { useEffect, useRef, useState } from 'react'
import type { DocMeta } from '../types'
import { deleteDoc, listDocs, saveDoc } from '../db'
import { parseFile } from '../importers'
import { tokenize } from '../tokenize'

export function Library({ onOpen, onStats }: {
  onOpen: (doc: DocMeta) => void
  onStats: () => void
}) {
  const [docs, setDocs] = useState<DocMeta[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPaste, setShowPaste] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = () => listDocs().then(setDocs)
  useEffect(() => {
    void refresh()
  }, [])

  async function addDoc(title: string, author: string, text: string): Promise<DocMeta> {
    const tokens = tokenize(text)
    if (tokens.length === 0) throw new Error('No readable words found')
    const meta: DocMeta = {
      id: crypto.randomUUID(),
      title: title.trim() || 'Untitled',
      author: author.trim(),
      totalWords: tokens.length,
      position: 0,
      addedAt: Date.now(),
      lastReadAt: 0,
    }
    await saveDoc(meta, tokens)
    return meta
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    let lastDoc: DocMeta | null = null
    try {
      for (const file of Array.from(files)) {
        setBusy(`Importing ${file.name}…`)
        const parsed = await parseFile(file)
        lastDoc = await addDoc(parsed.title, parsed.author, parsed.text)
      }
      if (files.length === 1 && lastDoc) onOpen(lastDoc)
      else await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
      await refresh()
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handlePaste(title: string, text: string) {
    setError(null)
    try {
      const fallback = text.trim().split(/\s+/).slice(0, 5).join(' ')
      const doc = await addDoc(title || fallback, '', text)
      setShowPaste(false)
      onOpen(doc)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    }
  }

  return (
    <div
      className="flex h-full flex-col bg-white text-slate-900 dark:bg-[#0b1220] dark:text-slate-100"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="flex items-center justify-between px-5 pt-4 pb-2">
        <h1 className="text-2xl font-bold">Library</h1>
        <button
          onClick={onStats}
          aria-label="Reading stats"
          className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 active:bg-slate-200 dark:text-slate-400 dark:active:bg-slate-700"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 20V10M10 20V4M16 20v-8M21 20H3" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {/* import row — buttons sized for thumbs */}
      <div className="flex gap-3 px-5 pb-3">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent font-medium text-white active:opacity-80"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 4v12m0-12L7 9m5-5l5 5M4 20h16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Import file
        </button>
        <button
          onClick={() => setShowPaste(true)}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 font-medium text-slate-700 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:active:bg-slate-700"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="6" y="4" width="12" height="16" rx="2" />
            <path d="M9 4a2 2 0 0 1 6 0" />
          </svg>
          Paste text
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          multiple
          accept=".epub,.pdf,.txt,.md,application/epub+zip,application/pdf,text/plain"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>
      <p className="px-5 pb-3 text-xs text-slate-400 dark:text-slate-500">
        EPUB · PDF · TXT — parsed on-device, nothing is uploaded.
      </p>

      {error && (
        <div className="mx-5 mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* document list */}
      <div className="flex-1 overflow-y-auto px-5 pb-[env(safe-area-inset-bottom)]">
        {docs === null ? null : docs.length === 0 ? (
          <div className="mt-16 text-center text-slate-400 dark:text-slate-500">
            <p className="text-4xl">📚</p>
            <p className="mt-3">Nothing here yet.</p>
            <p className="mt-1 text-sm">Import a book or paste some text to start reading.</p>
          </div>
        ) : (
          docs.map((doc) => {
            const pct =
              doc.totalWords > 1 ? Math.round((doc.position / (doc.totalWords - 1)) * 100) : 0
            return (
              <div
                key={doc.id}
                className="mb-2 flex items-center gap-3 rounded-xl bg-slate-50 p-4 active:bg-slate-100 dark:bg-[#101a2e] dark:active:bg-slate-800"
              >
                <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(doc)}>
                  <div className="truncate font-semibold">{doc.title}</div>
                  {doc.author && (
                    <div className="truncate text-sm text-slate-500 dark:text-slate-400">
                      {doc.author}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs whitespace-nowrap text-slate-500 tabular-nums dark:text-slate-400">
                      {pct}% · {doc.totalWords.toLocaleString()} words
                    </span>
                  </div>
                </button>
                {confirmDelete === doc.id ? (
                  <button
                    onClick={() => {
                      void deleteDoc(doc.id).then(refresh)
                      setConfirmDelete(null)
                    }}
                    className="h-11 shrink-0 rounded-lg bg-red-600 px-3 text-sm font-medium text-white"
                  >
                    Delete?
                  </button>
                ) : (
                  <button
                    aria-label={`Delete ${doc.title}`}
                    onClick={() => {
                      setConfirmDelete(doc.id)
                      setTimeout(() => setConfirmDelete((c) => (c === doc.id ? null : c)), 3000)
                    }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-200 dark:active:bg-slate-700"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0l1 13h8l1-13" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      {busy && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <p className="px-8 text-center text-sm">{busy}</p>
        </div>
      )}

      {showPaste && <PasteSheet onRead={handlePaste} onClose={() => setShowPaste(false)} />}
    </div>
  )
}

function PasteSheet({ onRead, onClose }: {
  onRead: (title: string, text: string) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="rounded-t-2xl bg-white px-5 pt-4 dark:bg-[#101a2e]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
        <h2 className="mb-3 text-lg font-semibold">Paste text</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="mb-2 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-3 text-sm outline-none focus:border-accent dark:border-slate-700"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste anything you want to read…"
          rows={7}
          className="w-full resize-none rounded-lg border border-slate-200 bg-transparent px-3 py-3 text-sm outline-none focus:border-accent dark:border-slate-700"
        />
        <button
          disabled={!text.trim()}
          onClick={() => onRead(title, text)}
          className="mt-3 h-12 w-full rounded-xl bg-accent font-medium text-white disabled:opacity-40"
        >
          Read
        </button>
      </div>
    </div>
  )
}
