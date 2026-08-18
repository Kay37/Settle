import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

const b64 = readFileSync(new URL('./app.tsx.gz.b64', import.meta.url), 'utf8')
const raw = gunzipSync(Buffer.from(b64.replace(/\s+/g, ''), 'base64'))
writeFileSync(new URL('../src/App.tsx', import.meta.url), raw)
console.log('inflated src/App.tsx', raw.length, 'bytes')
