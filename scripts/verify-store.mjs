import { createHash, createPublicKey, verify } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const MAX_PACK_BYTES = 16 * 1024 * 1024
const SHA256 = /^[a-f0-9]{64}$/i
const RELEASE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

const catalogue = JSON.parse(readFileSync('catalogue.json', 'utf8'))

if (catalogue.format !== 'knotebook-catalogue') {
  throw new Error('catalogue.json is not a Knotebook catalogue')
}
if (catalogue.version !== 1) {
  throw new Error('catalogue version must be 1')
}
if (!Array.isArray(catalogue.packs)) {
  throw new Error('catalogue.packs must be an array')
}

let publicKey = null
if (catalogue.publicKey) {
  const raw = Buffer.from(catalogue.publicKey, 'base64')
  if (raw.length !== 32) {
    throw new Error('catalogue.publicKey must be a 32-byte Ed25519 key')
  }
  const der = Buffer.concat([
    Buffer.from('302a300506032b6570032100', 'hex'),
    raw,
  ])
  publicKey = createPublicKey({ key: der, format: 'der', type: 'spki' })
}

const ids = new Set()
for (const entry of catalogue.packs) {
  for (const field of ['id', 'title', 'theme', 'url', 'sha256']) {
    if (typeof entry[field] !== 'string' || !entry[field].trim()) {
      throw new Error(`catalogue entry is missing ${field}`)
    }
  }
  if (!SHA256.test(entry.sha256)) {
    throw new Error(`bad sha256 for ${entry.id}`)
  }
  if (entry.release !== undefined && !RELEASE.test(entry.release)) {
    throw new Error(`bad release for ${entry.id}`)
  }
  if (ids.has(entry.id)) {
    throw new Error(`duplicate catalogue id ${entry.id}`)
  }
  ids.add(entry.id)
  if (entry.url.includes('..') || entry.url.startsWith('/')) {
    throw new Error(`pack url must stay inside the store: ${entry.url}`)
  }

  const path = resolve(entry.url)
  if (!existsSync(path)) {
    throw new Error(`missing pack file: ${entry.url}`)
  }
  if (statSync(path).size > MAX_PACK_BYTES) {
    throw new Error(`pack exceeds the 16 MB limit: ${entry.id}`)
  }
  const bytes = readFileSync(path)
  const hash = createHash('sha256').update(bytes).digest('hex')
  if (hash !== entry.sha256) {
    throw new Error(`hash mismatch: ${entry.id}`)
  }
  if (publicKey) {
    if (!entry.signature) {
      throw new Error(`unsigned pack: ${entry.id}`)
    }
    const ok = verify(
      null,
      bytes,
      publicKey,
      Buffer.from(entry.signature, 'base64'),
    )
    if (!ok) throw new Error(`bad signature: ${entry.id}`)
  }

  const pack = JSON.parse(bytes.toString('utf8'))
  if (pack.format !== 'knotebook-pack') {
    throw new Error(`bad pack format: ${entry.id}`)
  }
  if (pack.version !== 1) {
    throw new Error(`bad pack version: ${entry.id}`)
  }
  if (pack.id !== entry.id || pack.title !== entry.title) {
    throw new Error(`pack metadata does not match catalogue: ${entry.id}`)
  }
  if (pack.theme !== entry.theme) {
    throw new Error(`pack theme does not match catalogue: ${entry.id}`)
  }
  if (pack.release !== entry.release) {
    throw new Error(`pack release does not match catalogue: ${entry.id}`)
  }
  if (pack.cover !== undefined && !pack.cover.startsWith('data:')) {
    throw new Error(`pack cover must be a data URL: ${entry.id}`)
  }
  for (const [key, value] of Object.entries(pack.assets ?? {})) {
    if (typeof value !== 'string' || !value.startsWith('data:')) {
      throw new Error(`pack asset ${key} must be a data URL: ${entry.id}`)
    }
  }
  if (!Array.isArray(pack.stories) || pack.stories.length === 0) {
    throw new Error(`pack has no stories: ${entry.id}`)
  }
  for (const story of pack.stories) {
    if (
      !story ||
      typeof story.id !== 'string' ||
      typeof story.json !== 'string'
    ) {
      throw new Error(`bad story in pack: ${entry.id}`)
    }
    const parsed = JSON.parse(story.json)
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error(`bad story json in pack: ${entry.id}`)
    }
  }
}

console.log(
  `store ok (${catalogue.packs.length} pack(s), ${publicKey ? 'signed' : 'unsigned'} catalogue)`,
)