// Generates the PWA placeholder icons without any image dependencies:
// draws shapes into an RGBA buffer (4x supersampled for smooth edges) and
// encodes PNGs with node's built-in zlib.
//
//   node scripts/gen-icons.mjs
//
// Design: dark navy tile, two light guide ticks, red ORP/play triangle —
// the reader's focus anchor as an icon.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const BG = [11, 18, 32] // #0b1220
const TICK = [226, 232, 240] // slate-200
const RED = [239, 68, 68] // #ef4444

/** Draw the icon at `size`, optionally with rounded transparent corners. */
function drawIcon(size, { rounded, scale = 1 }) {
  const S = 4 // supersample factor
  const W = size * S
  const img = new Uint8Array(W * W * 4)
  const c = W / 2
  const radius = rounded ? 0.2 * W : 0
  // Content geometry (relative to W), shrunk by `scale` for maskable safe zone.
  const g = (v) => c + (v - 0.5) * W * scale
  const tickW = 0.022 * W * scale
  const tick = { x: g(0.5), y1a: g(0.2), y1b: g(0.31), y2a: g(0.69), y2b: g(0.8) }
  const tri = { x0: g(0.375), x1: g(0.655), halfH: 0.105 * W * scale }

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4
      // rounded-corner mask
      if (radius > 0) {
        const dx = Math.max(0, Math.abs(x - c) - (c - radius))
        const dy = Math.max(0, Math.abs(y - c) - (c - radius))
        if (dx * dx + dy * dy > radius * radius) {
          img[o + 3] = 0
          continue
        }
      }
      let [r, gr, b] = BG
      // guide ticks above and below the triangle
      if (
        Math.abs(x - tick.x) <= tickW &&
        ((y >= tick.y1a && y <= tick.y1b) || (y >= tick.y2a && y <= tick.y2b))
      ) {
        ;[r, gr, b] = TICK
      }
      // play/pivot triangle
      if (x >= tri.x0 && x <= tri.x1) {
        const maxDy = ((tri.x1 - x) / (tri.x1 - tri.x0)) * tri.halfH * 2
        if (Math.abs(y - c) <= maxDy) [r, gr, b] = RED
      }
      img[o] = r
      img[o + 1] = gr
      img[o + 2] = b
      img[o + 3] = 255
    }
  }
  return downsample(img, W, S)
}

/** Box-filter downsample by factor S (averages alpha too, for smooth corners). */
function downsample(img, W, S) {
  const w = W / S
  const out = new Uint8Array(w * w * 4)
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0, 0]
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const o = ((y * S + sy) * W + (x * S + sx)) * 4
          const a = img[o + 3] / 255
          acc[0] += img[o] * a
          acc[1] += img[o + 1] * a
          acc[2] += img[o + 2] * a
          acc[3] += img[o + 3]
        }
      }
      const o = (y * w + x) * 4
      const a = acc[3] / (S * S) / 255
      out[o] = a > 0 ? acc[0] / (S * S) / a : 0
      out[o + 1] = a > 0 ? acc[1] / (S * S) / a : 0
      out[o + 2] = a > 0 ? acc[2] / (S * S) / a : 0
      out[o + 3] = acc[3] / (S * S)
    }
  }
  return out
}

// ---- minimal PNG encoder -------------------------------------------------
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
function crc32(buf) {
  let c = -1
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}
function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  // scanlines, each prefixed with filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- outputs ---------------------------------------------------------------
mkdirSync(join(root, 'public/icons'), { recursive: true })
const targets = [
  ['public/icons/icon-192.png', 192, { rounded: true }],
  ['public/icons/icon-512.png', 512, { rounded: true }],
  ['public/icons/maskable-512.png', 512, { rounded: false, scale: 0.72 }],
  ['public/apple-touch-icon.png', 180, { rounded: false }],
]
for (const [file, size, opts] of targets) {
  writeFileSync(join(root, file), encodePng(drawIcon(size, opts), size))
  console.log('wrote', file)
}
