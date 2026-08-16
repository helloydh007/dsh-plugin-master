/**
 * Resolve the on-disk location of the active profile directory from a
 * Cordis Loader base URL, parse the profile manifest (`package.json`),
 * and read the profile patch layer (`cordis.patch.yml`). The host service
 * treats these reads as cheap and re-fetches on every list call — there is
 * no in-memory cache, so profile edits made by other surfaces are picked
 * up immediately by the next snapshot.
 */

import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface ProfileContext {
  /** Absolute path to the profile directory. */
  directory: string
  /** Profile name (basename of the directory). */
  name: string
  /** Absolute path to the profile `package.json`. */
  manifestFile: string
  /** Absolute path to the profile `cordis.patch.yml`. */
  patchFile: string
}

/** Resolve the profile directory from a Loader `baseUrl`. */
export function resolveProfile(baseUrl: string | undefined): ProfileContext {
  if (baseUrl === undefined || !baseUrl.startsWith('file:')) {
    throw new Error('dsh-plugin-master requires a file-backed profile (Cordis Loader baseUrl)')
  }
  const path = fileURLToPath(baseUrl)
  const directory = baseUrl.endsWith('/') ? path : dirname(path)
  if (!baseUrl.endsWith('/') && basename(path) !== 'cordis.yml') {
    throw new Error(`dsh-plugin-master expected a profile directory or cordis.yml, received ${path}`)
  }
  const name = basename(directory)
  return {
    directory,
    name,
    manifestFile: join(directory, 'package.json'),
    patchFile: join(directory, 'cordis.patch.yml'),
  }
}

/** Read and lightly validate a profile `package.json`. */
export function readProfileManifest(profile: ProfileContext): Record<string, unknown> {
  if (!existsSync(profile.manifestFile)) return {}
  try {
    const raw = readFileSync(profile.manifestFile, 'utf8')
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

export interface ProfileBundles {
  /** Packages declared in `dsh.profile.bundles`. */
  declared: string[]
  /** Packages actually present in `dependencies` AND that declare `dsh.bundle`. */
  effective: string[]
}

/** Extract the declared bundles list and compute the effective bundles. */
export function readProfileBundles(manifest: Record<string, unknown>): ProfileBundles {
  const dsh = manifest.dsh
  const profile = typeof dsh === 'object' && dsh !== null ? (dsh as Record<string, unknown>).profile : undefined
  const bundlesField = typeof profile === 'object' && profile !== null
    ? (profile as Record<string, unknown>).bundles
    : undefined
  const declared = Array.isArray(bundlesField) ? bundlesField.filter((b): b is string => typeof b === 'string') : []

  const deps = manifest.dependencies
  if (typeof deps !== 'object' || deps === null) {
    return { declared, effective: declared }
  }
  const effective = Object.keys(deps as Record<string, unknown>).filter((name) => declared.includes(name))
  // `declared` may list in-box bundles that are not dependencies — keep them.
  const merged = Array.from(new Set([...declared, ...effective]))
  return { declared, effective: merged }
}