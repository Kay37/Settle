import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public')

const iconSvg = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#163328"/>
  <g transform="translate(128 72) scale(3.2)" fill="#e7e0d2">
    <path d="M40 4 52 28h-8l12 18h-9l13 22H20l13-22h-9l12-18h-8L40 4Z"/>
    <path d="M36 68h8v12h-8z"/>
  </g>
  <g stroke="#2F6F6A" stroke-linecap="round" fill="none">
    <path stroke-width="7" d="M118 372h276"/>
    <path stroke-width="6" d="M138 396h236"/>
    <path stroke-width="5" d="M158 420h196"/>
  </g>
</svg>`

mkdirSync(outDir, { recursive: true })

const sizes = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]

for (const [name, size] of sizes) {
  const buf = await sharp(Buffer.from(iconSvg(size)))
    .resize(size, size)
    .png()
    .toBuffer()
  writeFileSync(join(outDir, name), buf)
  console.log(`wrote public/${name} (${size}x${size})`)
}
