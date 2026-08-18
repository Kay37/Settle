import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const raw = readFileSync(new URL('../src/App.tsx', import.meta.url))
const b64 = gzipSync(raw).toString('base64')
const wrapped = b64.match(/.{1,76}/g)?.join('\n') ?? b64
writeFileSync(new URL('./app.tsx.gz.b64', import.meta.url), wrapped + '\n')
console.log('deflated src/App.tsx → scripts/app.tsx.gz.b64', raw.length, 'bytes')
