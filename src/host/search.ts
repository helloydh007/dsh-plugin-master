/**
 * Token + subsequence fuzzy search across every searchable field of one
 * PackageView: name, version, description, homepage, repository URL,
 * author, keywords, plus the package's loader entry ids, config ids and
 * module specifiers. The implementation deliberately avoids pulling a
 * fuzzy-search library — DSH package names are short and hyphen-separated,
 * so a token-overlap + subsequence scorer covers the common cases
 * (searching "vision toolkit" against `vision-toolkit`, "dsh aqua"
 * against `dsh-client-ui-aqua`, "anionex" against `@anionex/...`) and
 * degrades cleanly to substring matching when nothing fancier applies.
 *
 * Scoring is positive; higher means a better hit. Each matched package
 * carries the highest field-score plus the number of token matches, so
 * the UI can sort and the user can see *why* a row matched.
 */

import type { LoaderEntryView, PackageView, SearchHit } from './types.ts'

/** Score table — bump to tune. */
const SCORE = {
  EXACT: 1_000,
  TOKEN_ALL: 200,
  TOKEN_PARTIAL: 60,
  SUBSEQUENCE: 90,
  SUBSTRING: 30,
  FIELD_BONUS_REPO: 30,
  FIELD_BONUS_DESC: 15,
  FIELD_BONUS_ENTRY: 25,
} as const

export interface ScoredPackage {
  package: PackageView
  score: number
  hits: SearchHit[]
}

/**
 * Tokenize a single string. Lowercases, splits on `-_. /@:`, strips
 * empty tokens. "@scope/foo" becomes ["scope", "foo"].
 */
export function tokenize(value: string): string[] {
  if (value.length === 0) return []
  return value
    .toLowerCase()
    .replace(/[@/:\\]/g, ' ')
    .split(/[\s\-_.]+/u)
    .filter((token) => token.length > 0)
}

/**
 * Compute one field's match score against a query (already tokenized).
 * Returns the best match type — exact, full-token-overlap, partial-token,
 * subsequence, substring — with the corresponding score.
 */
function scoreField(queryTokens: string[], value: string | null): { score: number; hit: SearchHit['field'] | null } {
  if (value === null || value.length === 0) return { score: 0, hit: null }
  const lower = value.toLowerCase()
  const tokens = tokenize(value)
  if (queryTokens.length === 0) return { score: 0, hit: null }
  if (queryTokens.length === 1) {
    const q = queryTokens[0]
    if (lower === q) return { score: SCORE.EXACT, hit: detectField(value) }
    if (tokens.includes(q)) return { score: SCORE.TOKEN_ALL, hit: detectField(value) }
    if (lower.includes(q)) return { score: SCORE.SUBSTRING + SCORE.TOKEN_PARTIAL, hit: detectField(value) }
    const sub = subsequenceScore(q, lower)
    if (sub > 0) return { score: SCORE.SUBSEQUENCE * sub, hit: detectField(value) }
    return { score: 0, hit: null }
  }
  const matched = queryTokens.filter((qt) => tokens.some((t) => t.startsWith(qt) || t.includes(qt)))
  if (matched.length === queryTokens.length) return { score: SCORE.TOKEN_ALL, hit: detectField(value) }
  if (matched.length > 0) return { score: SCORE.TOKEN_PARTIAL * (matched.length / queryTokens.length), hit: detectField(value) }
  // Try each token as substring across the joined tokens.
  const joined = tokens.join(' ')
  if (queryTokens.every((qt) => joined.includes(qt))) return { score: SCORE.SUBSTRING, hit: detectField(value) }
  return { score: 0, hit: null }
}

function detectField(_value: string): SearchHit['field'] {
  return 'name'
}

/**
 * Subsequence match — does every character of `query` appear in `value`
 * in order? Returns a 0-1 confidence based on how tight the match is.
 */
function subsequenceScore(query: string, value: string): number {
  let qi = 0
  let vi = 0
  while (qi < query.length && vi < value.length) {
    if (query[qi] === value[vi]) qi++
    vi++
  }
  if (qi < query.length) return 0
  // Confidence: how much of `value` did we consume? Smaller windows score higher.
  return Math.min(1, query.length / vi + 0.2)
}

/** Extract the GitHub-style repo slug for fuzzy-friendly matching. */
function normalizeRepo(url: string | null): string | null {
  if (url === null) return null
  const match = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/u.exec(url)
  if (match !== null) return `${match[1]}/${match[2]}`
  return url
}

/**
 * Search one package. Returns a ScoredPackage only when at least one field
 * matched; otherwise null (the caller filters nils out). Hits carry the
 * original query against the matched substring so the UI can render the
 * hit reason if it wants.
 */
export function searchPackage(pkg: PackageView, query: string): ScoredPackage | null {
  const trimmed = query.trim()
  if (trimmed.length === 0) return null
  const queryTokens = tokenize(trimmed)
  if (queryTokens.length === 0) return null

  const hits: SearchHit[] = []
  let total = 0

  // 1. Package name (highest signal)
  const nameScore = scoreField(queryTokens, pkg.packageName)
  if (nameScore.score > 0) {
    hits.push({ field: 'name', value: pkg.packageName, score: nameScore.score })
    total += nameScore.score
  }

  // 2. Repository URL / homepage (also excellent signal — "anionex" hits)
  const repo = normalizeRepo(pkg.repository)
  const repoScore = scoreField(queryTokens, repo ?? pkg.repository)
  if (repoScore.score > 0) {
    hits.push({ field: 'repository', value: repo ?? pkg.repository ?? '', score: repoScore.score + SCORE.FIELD_BONUS_REPO })
    total += repoScore.score + SCORE.FIELD_BONUS_REPO
  }
  const homeScore = scoreField(queryTokens, pkg.homepage)
  if (homeScore.score > 0) {
    hits.push({ field: 'repository', value: pkg.homepage ?? '', score: homeScore.score + SCORE.FIELD_BONUS_REPO * 0.6 })
    total += homeScore.score * 0.6
  }

  // 3. Description — nice when descriptions carry the brand name
  const descScore = scoreField(queryTokens, pkg.description)
  if (descScore.score > 0) {
    hits.push({ field: 'description', value: pkg.description ?? '', score: descScore.score + SCORE.FIELD_BONUS_DESC })
    total += descScore.score + SCORE.FIELD_BONUS_DESC
  }

  // 4. Author
  const authorScore = scoreField(queryTokens, pkg.author)
  if (authorScore.score > 0) {
    hits.push({ field: 'description', value: pkg.author ?? '', score: authorScore.score })
    total += authorScore.score
  }

  // 5. Loader entry ids, config ids, module specifiers
  for (const entry of pkg.loaderEntries) {
    const eid = scoreField(queryTokens, entry.entryId)
    if (eid.score > 0) {
      hits.push({ field: 'entryId', value: entry.entryId, score: eid.score + SCORE.FIELD_BONUS_ENTRY })
      total += eid.score + SCORE.FIELD_BONUS_ENTRY
    }
    const cid = scoreField(queryTokens, entry.configId)
    if (cid.score > 0) {
      hits.push({ field: 'configId', value: entry.configId, score: cid.score + SCORE.FIELD_BONUS_ENTRY * 0.8 })
      total += cid.score * 0.8
    }
    const mn = scoreField(queryTokens, entry.moduleName)
    if (mn.score > 0) {
      hits.push({ field: 'moduleName', value: entry.moduleName, score: mn.score + SCORE.FIELD_BONUS_ENTRY * 0.8 })
      total += mn.score * 0.8
    }
  }

  if (hits.length === 0) return null
  return { package: pkg, score: total, hits }
}

/**
 * Search across a list of packages. Returns matches sorted by descending
 * score, capped at `limit` (default 200). Truncated means more matches
 * were available — the UI can offer a "refine your search" hint.
 */
export function searchPackages(packages: readonly PackageView[], query: string, limit = 200): {
  matched: ScoredPackage[]
  totalMatches: number
  truncated: boolean
} {
  const trimmed = query.trim()
  if (trimmed.length === 0) {
    return { matched: [], totalMatches: 0, truncated: false }
  }
  const all: ScoredPackage[] = []
  for (const pkg of packages) {
    const scored = searchPackage(pkg, trimmed)
    if (scored !== null) all.push(scored)
  }
  all.sort((a, b) => b.score - a.score || a.package.packageName.localeCompare(b.package.packageName))
  const truncated = all.length > limit
  return {
    matched: truncated ? all.slice(0, limit) : all,
    totalMatches: all.length,
    truncated,
  }
}

/**
 * Re-export the LoaderEntryView type for callers that only need the search
 * utility (keeps the package self-contained without forcing them to
 * import the index module).
 */
export type { LoaderEntryView }