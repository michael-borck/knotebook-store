import { createHash, createPublicKey, verify } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const catalogue = JSON.parse(readFileSync('catalogue.json', 'utf8'))

if (catalogue.format !== 'knotebook-catalogue') {
  throw new Error('catalogue.json is not a Knotebook catalogue')
}
if (!Array.isArray(catalogue.packs)) {
  throw new Error('catalogue.packs must be an array')
}

let publicKey = null
if (catalogue.publicKey) {
  const raw = Buffer.from(catalogue.publicKey, 'base64')
  const der = Buffer.concat([
    Buffer.from('302a300506032b6570032100', 'hex'),
    raw,
  ])
  publicKey = createPublicKey({ key: der, format: 'der', type: 'spki' })
}

for (const entry of catalogue.packs) {
  const path = resolve(entry.url)
  if (!existsSync(path)) {
    throw new Error(`missing pack file: ${entry.url}`)
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
}

console.log(
  `store ok (${catalogue.packs.length} pack(s), ${publicKey ? 'signed' : 'unsigned'} catalogue)`,
)
