import { useEffect, useState } from 'react'
import type { DocMeta } from './types'
import { getDoc } from './db'
import { useSettings } from './hooks/useSettings'
import { Library } from './components/Library'
import { Reader } from './components/Reader'
import { Stats } from './components/Stats'

type Screen = { name: 'library' } | { name: 'reader'; doc: DocMeta } | { name: 'stats' }

const LAST_DOC_KEY = 'rsvp-last-doc'

export default function App() {
  const { settings, update } = useSettings()
  const [screen, setScreen] = useState<Screen>({ name: 'library' })

  // Remember where you left off: on launch, reopen the last book you read at
  // its saved word. getDoc reads the latest position from IndexedDB, so a
  // refresh or a cold app start both drop you back exactly where you were.
  useEffect(() => {
    const lastId = localStorage.getItem(LAST_DOC_KEY)
    if (!lastId) return
    void getDoc(lastId).then((doc) => {
      if (doc) setScreen((s) => (s.name === 'library' ? { name: 'reader', doc } : s))
    })
  }, [])

  const openDoc = (doc: DocMeta) => {
    localStorage.setItem(LAST_DOC_KEY, doc.id)
    setScreen({ name: 'reader', doc })
  }
  // Going back to the library is a one-tap trip within the session; the
  // last-read book is still remembered for the next launch (not cleared here).
  const backToLibrary = () => setScreen({ name: 'library' })

  switch (screen.name) {
    case 'reader':
      return (
        <Reader
          key={screen.doc.id}
          doc={screen.doc}
          settings={settings}
          updateSettings={update}
          onBack={backToLibrary}
        />
      )
    case 'stats':
      return <Stats onBack={() => setScreen({ name: 'library' })} />
    default:
      return <Library onOpen={openDoc} onStats={() => setScreen({ name: 'stats' })} />
  }
}
