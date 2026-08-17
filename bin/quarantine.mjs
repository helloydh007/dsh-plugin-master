#!/usr/bin/env node
/**
 * dsh-plugin-master quarantine CLI.
 *
 * When a plugin you are developing crashes the profile at boot, the
 * harness refuses to start and you cannot reach the settings UI to
 * disable it. This tool flips an owner-marked `disabled` row in the
 * profile's `cordis.patch.yml` directly, so the NEXT boot skips the
 * plugin and the UI opens again.
 *
 * Usage:
 *   node bin/quarantine.mjs disable <entryId> [--profile web] [--home ~/.dsh]
 *   node bin/quarantine.mjs enable  <entryId> [--profile web] [--home ~/.dsh]
 *   node bin/quarantine.mjs list    [--profile web] [--home ~/.dsh]
 *
 * `entryId` is the loader entry id shown in the boot error, e.g.
 * `dev-mode-demo` for the demo plugin (`failed to apply loader entry
 * dev-mode-demo`).
 *
 * `enable` restores the plugin: it flips the managed row to
 * `disabled: false` (or removes it). The plugin is retried on the next
 * boot, so fix the code before re-enabling.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseDocument, isMap, isSeq } from 'yaml'

const OWNER_MARKER = 'Managed by dsh-plugin-master. Remove this row to return control to higher-level configuration.'

function parseArgs(argv) {
  const out = { action: '', entryId: '', profile: 'web', home: process.env.DSH_HOME ?? join(homedir(), '.dsh') }
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--profile' && i + 1 < argv.length) { out.profile = argv[++i]; continue }
    if (a === '--home' && i + 1 < argv.length) { out.home = argv[++i]; continue }
    rest.push(a)
  }
  out.action = rest[0] ?? ''
  out.entryId = rest[1] ?? ''
  return out
}

function patchFile(args) {
  return join(resolve(args.home), 'profiles', args.profile, 'cordis.patch.yml')
}

function readDoc(file) {
  if (!existsSync(file)) return parseDocument('[]\n')
  const source = readFileSync(file, 'utf8')
  const doc = parseDocument(source)
  if (doc.errors.length > 0) throw new Error(`cannot parse ${file}: ${doc.errors[0].message}`)
  if (!isSeq(doc.contents)) throw new Error(`${file} must contain a YAML sequence`)
  return doc
}

function findManagedRow(doc, entryId) {
  for (const item of doc.contents.items) {
    if (!isMap(item)) continue
    if (item.get('id') !== entryId) continue
    if (typeof item.commentBefore === 'string' && item.commentBefore.includes(OWNER_MARKER)) return item
  }
  return null
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const file = patchFile(args)
  const doc = readDoc(file)

  if (args.action === 'list') {
    console.log(`Quarantined entries in ${file}:`)
    let found = 0
    for (const item of doc.contents.items) {
      if (!isMap(item)) continue
      if (typeof item.commentBefore !== 'string' || !item.commentBefore.includes(OWNER_MARKER)) continue
      const id = item.get('id')
      const disabled = item.get('disabled')
      if (id === 'plugin-master' && disabled === undefined) continue
      console.log(`  ${String(id)} disabled=${disabled === true ? 'true' : 'false'}`)
      found++
    }
    if (found === 0) console.log('  (none)')
    return
  }

  if ((args.action !== 'disable' && args.action !== 'enable') || !args.entryId) {
    console.error('usage: node bin/quarantine.mjs <disable|enable|list> <entryId> [--profile web] [--home ~/.dsh]')
    process.exit(2)
  }
  const enabled = args.action === 'enable'
  const row = findManagedRow(doc, args.entryId)
  if (row === null) {
    if (enabled) {
      console.log(`${args.entryId} is not quarantined; nothing to do.`)
      return
    }
    const node = doc.createNode({ id: args.entryId, disabled: true })
    doc.contents.add(node)
    const added = doc.contents.items.at(-1)
    if (added !== undefined && isMap(added)) added.commentBefore = OWNER_MARKER
  } else {
    row.set('disabled', !enabled)
    if (enabled) {
      // A disabled:false managed row is a no-op; drop it so the plugin
      // returns to its bundle-level default.
      const items = doc.contents.items
      const idx = items.indexOf(row)
      if (idx !== -1) items.splice(idx, 1)
    }
  }
  writeFileSync(file, String(doc))
  const verb = enabled ? 'enabled' : 'quarantined (disabled)'
  console.log(`${args.entryId}: ${verb} in ${file}`)
  console.log('Restart the profile for the change to take effect.')
}

main()
