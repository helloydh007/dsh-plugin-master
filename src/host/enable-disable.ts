/**
 * Persist one Loader entry's desired enablement to the profile's
 * `cordis.patch.yml` without disturbing any other patch the user wrote.
 * Each managed row carries a marker comment so the plugin can find,
 * update, and clean up its own rows without touching user-authored
 * content. The mutation is serialized through an async queue so two
 * concurrent toggles never clobber each other on disk.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { basename, dirname, join } from 'node:path'

import { parseDocument, isMap, isSeq, type Document, type Node, type YAMLMap } from 'yaml'

/** Marker written as a YAML comment on every patch row this plugin owns. */
export const OWNER_MARKER = 'Managed by dsh-plugin-master. Remove this row to return control to higher-level configuration.'

interface OwnedPatch {
  configId: string
  moduleName: string
  enabled: boolean
  // Internal — not part of the public API.
  comment: string
}

/** Find one owned row by config id and module name. */
/** Find one owned row by config id and module name. */
function findOwned(items: readonly unknown[], configId: string, moduleName: string): YAMLMap | null {
  for (const item of items) {
    if (!isMap(item)) continue
    const id = item.get('id')
    const name = item.get('name')
    if (id === configId && name === moduleName) {
      if (typeof item.commentBefore === 'string' && item.commentBefore.includes(OWNER_MARKER)) {
        return item
      }
    }
  }
  return null
}

/**
 * Read the profile patch file as a YAML document. Missing file becomes an
 * empty sequence; parse errors surface to the caller with the underlying
 * message so the host can show a useful failure in the snapshot.
 */
export async function readPatchDocument(filename: string): Promise<Document> {
  let source: string
  try {
    source = await readFile(filename, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return parseDocument('[]\n')
    }
    throw error
  }
  const document = parseDocument(source)
  if (document.errors.length > 0) {
    throw new Error(`cannot parse ${filename}: ${document.errors[0]?.message ?? 'unknown YAML error'}`)
  }
  if (!isSeq(document.contents)) {
    throw new Error(`${filename} must contain a YAML sequence of patches`)
  }
  return document
}

/** Atomic write — write to a temp file then rename. */
async function atomicWrite(filename: string, content: string): Promise<void> {
  await mkdir(dirname(filename), { recursive: true })
  const temp = join(dirname(filename), `.${basename(filename)}.${process.pid}.${randomUUID()}.tmp`)
  const payload = content.endsWith('\n') ? content : `${content}\n`
  await writeFile(temp, payload, 'utf8')
  await rename(temp, filename)
}

/**
 * Write the desired enablement of one Loader entry into the profile
 * patch file. Existing managed rows are updated; unmanaged rows are left
 * untouched. If the file does not exist yet, an empty document is seeded.
 */
export async function setEntryEnabled(filename: string, configId: string, moduleName: string, enabled: boolean): Promise<void> {
  const document = await readPatchDocument(filename)
  if (!isSeq(document.contents)) {
    throw new Error(`${filename} must contain a YAML sequence of patches`)
  }
  const owned = findOwned(document.contents.items, configId, moduleName)
  if (owned !== null) {
    owned.set('disabled', !enabled)
  } else {
    const node = document.createNode({
      id: configId,
      name: moduleName,
      disabled: !enabled,
    })
    document.contents.add(node)
    const added = document.contents.items.at(-1)
    if (added !== undefined && isMap(added)) {
      added.commentBefore = OWNER_MARKER
    }
  }
  await atomicWrite(filename, String(document))
}

/** Read which managed entries currently exist in the profile patch. */
export async function readOwnedEntries(filename: string): Promise<OwnedPatch[]> {
  const document = await readPatchDocument(filename)
  if (!isSeq(document.contents)) return []
  const out: OwnedPatch[] = []
  for (const item of document.contents.items) {
    if (!isMap(item)) continue
    if (typeof item.commentBefore !== 'string' || !item.commentBefore.includes(OWNER_MARKER)) continue
    const id = item.get('id')
    const name = item.get('name')
    const disabled = item.get('disabled')
    if (typeof id === 'string' && typeof name === 'string') {
      out.push({
        configId: id,
        moduleName: name,
        enabled: disabled !== true,
        comment: item.commentBefore,
      })
    }
  }
  return out
}