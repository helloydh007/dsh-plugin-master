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
 *   node bin/quarantine.mjs ls       [--profile web] [--home ~/.dsh]
 *   node bin/quarantine.mjs list     [--profile web] [--home ~/.dsh]
 *   node bin/quarantine.mjs disable <entryId> [--profile web] [--home ~/.dsh]
 *   node bin/quarantine.mjs enable  <entryId> [--profile web] [--home ~/.dsh]
 *
 * `ls` lists every plugin mounted in the profile with its loader entry
 * id, package name and status — use it to find the entryId of the plugin
 * named in the boot error, e.g. `dev-mode-demo` for the demo plugin
 * (`failed to apply loader entry dev-mode-demo (dsh-dev-mode-demo)`).
 *
 * `list` shows only the currently quarantined entries.
 *
 * `enable` restores the plugin: it removes the managed row, so the
 * plugin is retried on the next boot — fix the code before re-enabling.
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

function profileDir(args) {
  return join(resolve(args.home), 'profiles', args.profile)
}

function patchFile(args) {
  return join(profileDir(args), 'cordis.patch.yml')
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

/** Collect `{ id, name, disabled }` from a YAML `insert` list (bundle patch or profile patch). */
function collectInserts(doc, into) {
  for (const item of doc.contents.items) {
    if (!isMap(item)) continue
    const insert = item.get('insert')
    if (insert === null || insert === undefined) continue
    if (!isSeq(insert)) continue
    for (const row of insert.items) {
      if (!isMap(row)) continue
      const id = row.get('id')
      const name = row.get('name')
      if (typeof id !== 'string') continue
      into.set(id, { id, name: typeof name === 'string' ? name : '', disabled: row.get('disabled') === true })
    }
  }
}

/**
 * Enumerate every plugin the profile mounts:
 *   - the profile's own cordis.patch.yml inserts
 *   - each `dsh.profile.bundles` dependency's bundle `cordis.patch.yml`
 *     inserts (resolved under the profile's node_modules)
 * Plus the quarantined (owner-marked disabled) set, cross-referenced by
 * entry id.
 */
function collectPlugins(args) {
  const dir = profileDir(args)
  const entries = new Map()
  const manifestFile = join(dir, 'package.json')
  if (existsSync(manifestFile)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
      const bundles = manifest.dsh?.profile?.bundles ?? []
      const nodeModules = join(dir, 'node_modules')
      for (const pkg of bundles) {
        const scope = pkg.startsWith('@') ? pkg.split('/').slice(0, 2).join('/') : pkg
        const pkgDir = join(nodeModules, scope)
        const pkgManifest = join(pkgDir, 'package.json')
        if (!existsSync(pkgManifest)) continue
        let patch
        try {
          patch = JSON.parse(readFileSync(pkgManifest, 'utf8')).dsh?.bundle?.patch
        } catch { continue }
        if (typeof patch !== 'string') continue
        const patchFile = join(pkgDir, patch)
        if (!existsSync(patchFile)) continue
        collectInserts(readDoc(patchFile), entries)
      }
    } catch {
      // manifest unreadable — fall through to the profile patch only
    }
  }
  collectInserts(readDoc(patchFile(args)), entries)
  // Mark owner-managed disabled rows.
  const doc = readDoc(patchFile(args))
  for (const item of doc.contents.items) {
    if (!isMap(item)) continue
    if (typeof item.commentBefore !== 'string' || !item.commentBefore.includes(OWNER_MARKER)) continue
    const id = item.get('id')
    if (typeof id === 'string' && entries.has(id)) {
      entries.get(id).disabled = item.get('disabled') === true
      entries.get(id).quarantined = true
    }
  }
  return entries
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const file = patchFile(args)

  if (args.action === 'ls') {
    const entries = collectPlugins(args)
    const rows = [...entries.values()].sort((a, b) => a.id.localeCompare(b.id))
    if (rows.length === 0) {
      console.log(`No plugins found in profile "${args.profile}".`)
      return
    }
    const maxId = Math.max(8, ...rows.map((r) => r.id.length))
    const maxName = Math.max(12, ...rows.map((r) => r.name.length))
    const pad = (s, n) => String(s).padEnd(n)
    console.log(`Plugins in profile "${args.profile}" (${file}):`)
    console.log(`  ${pad('ENTRY ID', maxId)}  ${pad('PACKAGE', maxName)}  STATUS`)
    for (const row of rows) {
      const status = row.quarantined
        ? row.disabled ? 'quarantined' : 'managed'
        : row.disabled ? 'disabled' : 'enabled'
      const isSystem = row.name.startsWith('@deepseek-ai/') ? ' (system)' : ''
      console.log(`  ${pad(row.id, maxId)}  ${pad(row.name, maxName)}  ${status}${isSystem}`)
    }
    console.log('')
    console.log('To quarantine:  node bin/quarantine.mjs disable <ENTRY ID>')
    return
  }

  if (args.action === 'list') {
    console.log(`Quarantined entries in ${file}:`)
    let found = 0
    const doc = readDoc(file)
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
    console.error('usage: node bin/quarantine.mjs <ls|list|disable|enable> [entryId] [--profile web] [--home ~/.dsh]')
    process.exit(2)
  }
  const enabled = args.action === 'enable'
  const doc = readDoc(file)
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
