import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { DocMeta, Session } from './types'

interface RsvpDB extends DBSchema {
  /** Document metadata — small, safe to getAll() for the library list. */
  docs: { key: string; value: DocMeta }
  /** Token streams, keyed by doc id — only loaded when a doc is opened. */
  texts: { key: string; value: { id: string; tokens: string[] } }
  sessions: { key: string; value: Session }
}

let dbPromise: Promise<IDBPDatabase<RsvpDB>> | null = null

function db() {
  dbPromise ??= openDB<RsvpDB>('rsvp-reader', 1, {
    upgrade(d) {
      d.createObjectStore('docs', { keyPath: 'id' })
      d.createObjectStore('texts', { keyPath: 'id' })
      d.createObjectStore('sessions', { keyPath: 'id' })
    },
  })
  return dbPromise
}

export async function listDocs(): Promise<DocMeta[]> {
  const docs = await (await db()).getAll('docs')
  return docs.sort((a, b) => (b.lastReadAt || b.addedAt) - (a.lastReadAt || a.addedAt))
}

export async function getDoc(id: string): Promise<DocMeta | undefined> {
  return (await db()).get('docs', id)
}

export async function getTokens(id: string): Promise<string[]> {
  const row = await (await db()).get('texts', id)
  return row?.tokens ?? []
}

export async function saveDoc(meta: DocMeta, tokens: string[]): Promise<void> {
  const d = await db()
  const tx = d.transaction(['docs', 'texts'], 'readwrite')
  await Promise.all([
    tx.objectStore('docs').put(meta),
    tx.objectStore('texts').put({ id: meta.id, tokens }),
    tx.done,
  ])
}

export async function savePosition(id: string, position: number): Promise<void> {
  const d = await db()
  const meta = await d.get('docs', id)
  if (!meta) return
  meta.position = position
  meta.lastReadAt = Date.now()
  await d.put('docs', meta)
}

export async function deleteDoc(id: string): Promise<void> {
  const d = await db()
  const tx = d.transaction(['docs', 'texts'], 'readwrite')
  await Promise.all([
    tx.objectStore('docs').delete(id),
    tx.objectStore('texts').delete(id),
    tx.done,
  ])
}

export async function saveSession(s: Session): Promise<void> {
  await (await db()).put('sessions', s)
}

export async function listSessions(): Promise<Session[]> {
  const rows = await (await db()).getAll('sessions')
  return rows.sort((a, b) => a.startedAt - b.startedAt)
}
