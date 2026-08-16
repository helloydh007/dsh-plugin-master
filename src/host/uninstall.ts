/**
 * Uninstall one user-installed package by delegating to the `dsh` launcher.
 * We spawn `dsh plugin --profile <name> remove <package>` synchronously:
 *   - the launcher owns pnpm invocation, reconciliation of the bundle
 *     stack, and the post-remove profile bookkeeping,
 *   - we only need to wait for its exit and surface the result.
 *
 * The host is intentionally conservative — we never edit the profile
 * `package.json` directly, never delete a directory under `node_modules`
 * by hand. Doing so would skip the `bundle` reconciliation that drops the
 * removed package out of `dsh.profile.bundles`, which is what keeps the
 * Loader from trying to mount a package that no longer exists.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

export interface UninstallRequest {
  /** Absolute path to the profile directory (where pnpm runs). */
  profileDirectory: string
  /** Profile name (matches `~/.dsh/profiles/<name>`). */
  profileName: string
  /** Package name to remove. */
  packageName: string
  /** Optional dsh launcher path; defaults to `dsh` on PATH. */
  dshBin?: string
}

export interface UninstallOutcome {
  exitCode: number
  stdout: string
  stderr: string
}

/**
 * Resolve the absolute path of the `dsh` launcher on this system. The
 * launcher is what knows how to remove a plugin from a profile; this
 * helper exists so test code can stub the binary path.
 */
export function findDshBin(): string {
  return 'dsh'
}

/** Run one `dsh plugin remove` invocation synchronously. */
export function runUninstall(request: UninstallRequest): UninstallOutcome {
  const bin = request.dshBin ?? findDshBin()
  const args = ['plugin', '--profile', request.profileName, 'remove', request.packageName]
  const result = spawnSync(bin, args, {
    cwd: request.profileDirectory,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if (result.error !== undefined) {
    if ((result.error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        exitCode: 127,
        stdout: '',
        stderr: `dsh not found on PATH — install the dsh CLI to manage profile plugins`,
      }
    }
    throw result.error
  }
  return {
    exitCode: result.status ?? 1,
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
  }
}

/**
 * Verify the post-uninstall state — the package directory should be gone
 * from the profile's node_modules. We only check this after a successful
 * exit code, so a clean removal returns true.
 */
export function verifyRemoved(profileDirectory: string, packageName: string): boolean {
  const nodeModules = `${profileDirectory}/node_modules`
  if (!existsSync(nodeModules)) return true
  if (packageName.startsWith('@')) {
    const slash = packageName.indexOf('/')
    if (slash < 0) return true
    const scope = packageName.slice(0, slash)
    const name = packageName.slice(slash + 1)
    return !existsSync(`${nodeModules}/${scope}/${name}`)
  }
  return !existsSync(`${nodeModules}/${packageName}`)
}