# RSVP Focus Reader

An installable, offline-capable Progressive Web App that reads text to you **one
word at a time** using RSVP (Rapid Serial Visual Presentation). Words flash in a
fixed position with the Optimal Recognition Point pinned to a static anchor, so
your eyes never move and you read faster.

**Phone-first. No accounts, no backend, no cloud.** Everything lives on-device in
IndexedDB and works with the network off once installed.

👉 **Live app:** https://superwalrus01.github.io/rsvp-reader/

## Features

**Reading**
- One word at a time with **ORP alignment** — the pivot letter is drawn in an
  accent colour and locked to a fixed horizontal anchor with static guide ticks,
  so it stays put no matter the word length.
- **Smart timing** engine: base delay `60000 / WPM`, plus extra time for long
  words, longer pauses after sentence-ending punctuation, shorter pauses after
  clause punctuation, and a clear beat at paragraph breaks. Tunable and toggleable.
- **Wake Lock** keeps the screen awake while playing, released on pause.

**Phone-first controls**
- Tap anywhere on the reading area to play/pause.
- Swipe left/right to scrub.
- Bottom bar (within thumb reach, above the home indicator) with WPM stepper,
  restart, settings, progress scrubber, and a live `word N / total` + ETA readout.
- Keyboard shortcuts as a laptop nicety: space = play/pause, ←/→ seek, ↑/↓ speed.
- 44×44px minimum touch targets throughout; safe-area insets respected.

**Import (all client-side — nothing is ever uploaded)**
- **EPUB** (primary): reads the OPF spine for correct order, strips tags, pulls
  title/author from metadata.
- **PDF**: extracts text with PDF.js, de-hyphenates line-break splits, collapses
  hard wraps into paragraphs, and strips repeated headers/footers/page numbers.
- **`.txt` / `.md`** files and **paste**.

**Library & stats**
- All documents saved locally with title, author, and % progress.
- Reopen to **resume exactly** where you left off; a refresh never loses your place.
- Stats screen (Phase 2): total words, average/last WPM, day streak, and a
  WPM-over-time chart — computed honestly from local session records.

## Tech

React + Vite + TypeScript · Tailwind CSS v4 · `idb` (IndexedDB) · `jszip` +
`DOMParser` (EPUB) · `pdfjs-dist` (PDF) · `vite-plugin-pwa` (manifest + service
worker). No server, no auth, no database.

## Develop

```bash
npm install
npm run dev        # dev server
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build locally
npm run icons      # regenerate PWA icons (dependency-free generator)
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and
publishes `dist/` to GitHub Pages. The Vite `base` is set to `/rsvp-reader/` to
match the Pages path.

## Install on your phone

Open the live URL in your phone's browser and choose **Add to Home Screen**. On
iPhone this is required for full standalone + reliable offline behaviour and the
Wake Lock. Once installed, it opens instantly and reads saved books with the
network off.
