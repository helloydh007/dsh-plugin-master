/**
 * The plugin master settings tab. Renders two groups (system + user),
 * each as a stack of package cards. The tab owns the search input and
 * a per-card expansion state; the cards own their loader entries and
 * mutation UI. This split keeps the parent simple and lets the cards
 * remain memoizable for the (usually large) system group.
 *
 * The component receives the host Remote face via the `injected` prop
 * supplied by the slot registration. The `t` prop is the locale-bound
 * translate function for the master namespace. Both arrive as props —
 * the slot system assembles them — so there is no useSlot hook here.
 *
 * Class names are literal `pm-*` strings (see `styles.ts`); the plugin
 * deliberately avoids CSS Modules because the module-CSS pipeline hands
 * the bundle a class map instead of CSS text, which broke the injected
 * stylesheet.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { IconSearchOutline16, IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'

import type { PackageSnapshot, PackageView, MutationReceipt, SearchOptions } from '../../host/types.ts'
import { locales } from '../locales.ts'

import { EntryRow } from './EntryRow.tsx'
import { UninstallDialog } from './UninstallDialog.tsx'

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ')

export type PluginMasterTabT = (key: keyof typeof locales.zh, params?: Record<string, unknown>) => string

export interface PluginMasterTabProps {
  list: () => Promise<PackageSnapshot>
  search: (options: SearchOptions) => Promise<{ matchedPackages: PackageView[]; totalMatches: number; truncated: boolean }>
  setEntryEnabled: (entryId: string, enabled: boolean) => Promise<MutationReceipt>
  setPackageEnabled: (packageName: string, enabled: boolean) => Promise<MutationReceipt>
  uninstall: (packageName: string) => Promise<MutationReceipt>
  getDevMode: () => Promise<boolean>
  setDevMode: (enabled: boolean) => Promise<MutationReceipt>
  t: PluginMasterTabT
}

export function PluginMasterTab(props: PluginMasterTabProps) {
  const { t } = props
  const [snapshot, setSnapshot] = useState<PackageSnapshot | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pendingUninstall, setPendingUninstall] = useState<string | null>(null)
  const [lastReceipt, setLastReceipt] = useState<MutationReceipt | null>(null)
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false)
  const [devMode, setDevMode] = useState<boolean | null>(null)

  /** 统一的 receipt 落地逻辑:更新状态,并在有失败/待重启项时弹出提示框。 */
  const applyReceipt = useCallback((receipt: MutationReceipt) => {
    setLastReceipt(receipt)
    setSnapshot(receipt.snapshot)
    const hasProblems = receipt.items.some(
      (item) => item.status === 'failed' || item.status === 'restart-required',
    )
    if (hasProblems) setReceiptDialogOpen(true)
  }, [])

  // 读取开发模式开关状态(与首次列表加载并行)。
  useEffect(() => {
    let current = true
    void props.getDevMode().then((value) => {
      if (current) setDevMode(value)
    }, () => {
      if (current) setDevMode(false)
    })
    return () => { current = false }
  }, [props])

  const toggleDevMode = useCallback(async () => {
    if (devMode === null) return
    const next = !devMode
    setDevMode(next)
    try {
      const receipt = await props.setDevMode(next)
      applyReceipt(receipt)
    } catch (error) {
      setDevMode(!next)
      applyReceipt({
        succeeded: false,
        items: [{ entryId: 'dsh-plugin-master', status: 'failed', message: errorMessage(error) }],
        snapshot: snapshot ?? null as unknown as PackageSnapshot,
      })
    }
  }, [devMode, props, applyReceipt, snapshot])

  const reload = useCallback(async () => {
    setStatus('loading')
    try {
      const snap = await props.list()
      setSnapshot(snap)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [props])

  useEffect(() => {
    void reload()
  }, [reload])

  const filtered = useMemo(() => {
    if (snapshot === null) return null
    if (query.trim().length === 0) return snapshot
    const lower = query.trim().toLowerCase()
    const packages = snapshot.packages.filter((pkg) => packageMatchesQuery(pkg, lower))
    return { ...snapshot, packages }
  }, [snapshot, query])

  const toggle = useCallback((name: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const collapseAll = useCallback(() => setExpanded(new Set()), [])
  const expandAll = useCallback(() => {
    if (filtered === null) return
    setExpanded(new Set(filtered.packages.map((pkg) => pkg.packageName)))
  }, [filtered])

  const onSetEntryEnabled = useCallback(
    async (entryId: string, enabled: boolean) => {
      try {
        const receipt = await props.setEntryEnabled(entryId, enabled)
        applyReceipt(receipt)
      } catch (error) {
        applyReceipt({
          succeeded: false,
          items: [{ entryId, status: 'failed', message: errorMessage(error) }],
          snapshot: snapshot ?? null as unknown as PackageSnapshot,
        })
      }
    },
    [props, snapshot, applyReceipt],
  )

  const onSetPackageEnabled = useCallback(
    async (packageName: string, enabled: boolean) => {
      try {
        const receipt = await props.setPackageEnabled(packageName, enabled)
        applyReceipt(receipt)
      } catch (error) {
        applyReceipt({
          succeeded: false,
          items: [{ entryId: packageName, status: 'failed', message: errorMessage(error) }],
          snapshot: snapshot ?? null as unknown as PackageSnapshot,
        })
      }
    },
    [props, snapshot, applyReceipt],
  )

  const onConfirmUninstall = useCallback(
    async (packageName: string) => {
      setPendingUninstall(null)
      try {
        const receipt = await props.uninstall(packageName)
        applyReceipt(receipt)
      } catch (error) {
        applyReceipt({
          succeeded: false,
          items: [{ entryId: packageName, status: 'failed', message: errorMessage(error) }],
          snapshot: snapshot ?? null as unknown as PackageSnapshot,
        })
      }
    },
    [props, snapshot, applyReceipt],
  )

  const systemPackages = filtered?.packages.filter((pkg) => pkg.isSystem) ?? []
  const userPackages = filtered?.packages.filter((pkg) => pkg.isUser) ?? []

  // 最近一次操作中,每个包自己的失败/待重启消息。提示要出现在用户点击的
  // 卡片上,而不是只在页面顶部一行(那样用户看不到)。
  const failureByPackage = useMemo(() => {
    const map = new Map<string, string>()
    if (lastReceipt !== null && snapshot !== null) {
      for (const item of lastReceipt.items) {
        if (item.status !== 'failed' && item.status !== 'restart-required') continue
        for (const pkg of snapshot.packages) {
          if (pkg.loaderEntries.some((entry) => entry.entryId === item.entryId)) {
            const text = item.message !== null && item.message.length > 0
              ? item.message
              : t(receiptKey(item.status))
            map.set(pkg.packageName, text)
            break
          }
        }
      }
    }
    return map
  }, [lastReceipt, snapshot, t])

  if (status === 'loading') {
    return <p className="pm-statusLine">{t('loadError').replace('loadError', '正在读取插件…')}</p>
  }

  if (status === 'error') {
    return (
      <div className="pm-failure">
        <p role="alert">{t('loadError')}</p>
        <button type="button" onClick={() => void reload()}>{t('retry')}</button>
      </div>
    )
  }

  if (snapshot === null || filtered === null) return null

  return (
    <div className="pm-section">
      <header className="pm-header">
        <h2 className="pm-headerTitle">{t('headerTitle')}</h2>
        <p className="pm-headerIntro">{t('headerIntro')}</p>
        <label className="pm-devMode">
          <input
            type="checkbox"
            checked={devMode === true}
            disabled={devMode === null}
            onChange={() => void toggleDevMode()}
          />
          <span>
            <strong>{t('devMode')}</strong>
            <em>{t(devMode === true ? 'devModeOn' : 'devModeOff')}</em>
            <small>{t('devModeHint')}</small>
          </span>
        </label>
      </header>

      <div className="pm-toolbar">
        <label className="pm-search">
          <IconSearchOutline16 aria-hidden="true" className="pm-searchIcon" />
          <span className="pm-visuallyHidden">{t('search')}</span>
          <input
            className="pm-searchInput"
            type="search"
            value={query}
            placeholder={t('searchPlaceholder')}
            aria-label={t('search')}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        <button type="button" className="pm-toolbarButton" onClick={() => void reload()}>
          {t('refresh')}
        </button>
        <button type="button" className="pm-toolbarButton" onClick={expandAll}>
          {t('expandAll')}
        </button>
        <button type="button" className="pm-toolbarButton" onClick={collapseAll}>
          {t('collapseAll')}
        </button>
        <div className="pm-counters">
          <span>{t('systemTotal')}: <strong>{filtered.systemCount}</strong></span>
          <span>{t('userTotal')}: <strong>{filtered.userCount}</strong></span>
          <span>{t('totalPlugins')}: <strong>{filtered.packages.length}</strong></span>
        </div>
      </div>

      {lastReceipt !== null ? (
        <p
          className="pm-statusLine"
          data-status={lastReceipt.items.some((item) => item.status === 'failed') ? 'failed' : 'changed'}
        >
          {lastReceipt.items
            .map((item) => `${item.entryId}: ${t(receiptKey(item.status))}${item.message !== null ? ` (${item.message})` : ''}`)
            .join('; ')}
        </p>
      ) : null}

      <div className="pm-groups">
        <PackageGroup
          title={t('systemSection')}
          hint={t('systemSectionHint')}
          packages={systemPackages}
          empty={t('emptySystem')}
          expanded={expanded}
          onToggle={toggle}
          t={t}
          failures={failureByPackage}
          onSetEntryEnabled={onSetEntryEnabled}
          onSetPackageEnabled={onSetPackageEnabled}
          onRequestUninstall={setPendingUninstall}
        />
        <PackageGroup
          title={t('userSection')}
          hint={t('userSectionHint')}
          packages={userPackages}
          empty={t('emptyUser')}
          expanded={expanded}
          onToggle={toggle}
          t={t}
          failures={failureByPackage}
          onSetEntryEnabled={onSetEntryEnabled}
          onSetPackageEnabled={onSetPackageEnabled}
          onRequestUninstall={setPendingUninstall}
        />
      </div>

      {query.trim().length > 0 && filtered.packages.length === 0 ? (
        <p className="pm-emptyState">{t('noMatches')}</p>
      ) : null}

      {pendingUninstall !== null ? (
        <UninstallDialog
          packageName={pendingUninstall}
          t={t}
          onCancel={() => setPendingUninstall(null)}
          onConfirm={() => void onConfirmUninstall(pendingUninstall)}
        />
      ) : null}

      {receiptDialogOpen && lastReceipt !== null ? (
        <ReceiptDialog
          receipt={lastReceipt}
          t={t}
          onClose={() => setReceiptDialogOpen(false)}
        />
      ) : null}
    </div>
  )
}

interface ReceiptDialogProps {
  receipt: MutationReceipt
  t: PluginMasterTabT
  onClose: () => void
}

/**
 * 弹出失败/待重启提示。固定位置的一行提示在插件很多时没人注意;
 * 弹窗强制出现在视线中央,列出每条失败项的具体原因。
 */
function ReceiptDialog({ receipt, t, onClose }: ReceiptDialogProps): ReactNode {
  const problems = receipt.items.filter(
    (item) => item.status === 'failed' || item.status === 'restart-required',
  )
  return (
    <div className="pm-dialogBackdrop" role="dialog" aria-modal="true" aria-labelledby="pm-receipt-title">
      <div className="pm-dialog">
        <h3 id="pm-receipt-title">{t('operationFailed')}</h3>
        <ul className="pm-receiptList">
          {problems.map((item) => (
            <li key={item.entryId}>
              <strong>{item.entryId}</strong>
              <span className={`pm-tag ${item.status === 'failed' ? 'pm-tagDisabled' : ''}`}>
                {t(receiptKey(item.status))}
              </span>
              {item.message !== null && item.message.length > 0 ? (
                <p className="pm-receiptMessage">{item.message}</p>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="pm-dialogActions">
          <button type="button" onClick={onClose}>{t('close')}</button>
        </div>
      </div>
    </div>
  )
}

interface PackageGroupProps {
  title: string
  hint: string
  packages: PackageView[]
  empty: string
  expanded: Set<string>
  onToggle: (packageName: string) => void
  t: PluginMasterTabT
  failures: ReadonlyMap<string, string>
  onSetEntryEnabled: (entryId: string, enabled: boolean) => Promise<void>
  onSetPackageEnabled: (packageName: string, enabled: boolean) => Promise<void>
  onRequestUninstall: (packageName: string) => void
}

function PackageGroup(props: PackageGroupProps): ReactNode {
  return (
    <section className="pm-group">
      <header className="pm-groupHeader">
        <h3 className="pm-groupTitle">{props.title}</h3>
        <p className="pm-groupHint">{props.hint}</p>
      </header>
      {props.packages.length === 0 ? (
        <p className="pm-emptyState">{props.empty}</p>
      ) : (
        <ul className="pm-cards">
          {props.packages.map((pkg) => (
            <PackageCard
              key={pkg.packageName}
              pkg={pkg}
              open={props.expanded.has(pkg.packageName)}
              onToggle={() => props.onToggle(pkg.packageName)}
              t={props.t}
              failureMessage={props.failures.get(pkg.packageName) ?? null}
              onSetEntryEnabled={props.onSetEntryEnabled}
              onSetPackageEnabled={props.onSetPackageEnabled}
              onRequestUninstall={props.onRequestUninstall}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

interface PackageCardProps {
  pkg: PackageView
  open: boolean
  onToggle: () => void
  t: PluginMasterTabT
  failureMessage: string | null
  onSetEntryEnabled: (entryId: string, enabled: boolean) => Promise<void>
  onSetPackageEnabled: (packageName: string, enabled: boolean) => Promise<void>
  onRequestUninstall: (packageName: string) => void
}

function PackageCard(props: PackageCardProps): ReactNode {
  const { pkg, open, onToggle, t } = props
  const headerId = `pm-${encodeURIComponent(pkg.packageName)}-header`
  return (
    <li className="pm-card" data-open={open ? 'true' : undefined}>
      <button
        type="button"
        className="pm-cardHeader"
        aria-expanded={open}
        aria-controls={`${headerId}-body`}
        onClick={onToggle}
      >
        <span className="pm-cardTitle">
          <strong title={pkg.packageName}>{pkg.packageName}</strong>
          <span>{pkg.description ?? pkg.version ?? pkg.repository ?? ''}</span>
        </span>
        <span className="pm-cardTags">
          <span className={cx('pm-tag', pkg.isSystem ? 'pm-tagSystem' : 'pm-tagUser')}>
            {pkg.isSystem ? t('systemSection') : t('userSection')}
          </span>
          <span className={cx('pm-tag', pkg.enabled ? 'pm-tagEnabled' : 'pm-tagDisabled')}>
            {pkg.enabled ? t('enabledTag') : t('disabledTag')}
          </span>
          <IconChevronDownOutline14 size={12} aria-hidden="true" />
        </span>
      </button>

      {open ? (
        <div className="pm-cardBody" id={`${headerId}-body`}>
          <dl>
            {pkg.version !== null ? (
              <div className="pm-field">
                <dt>{t('packageVersion')}</dt>
                <dd>{pkg.version}</dd>
              </div>
            ) : null}
            <div className="pm-field">
              <dt>{t('packageInstallKind')}</dt>
              <dd>
                {t(installKindKey(pkg.installKind))}
                {pkg.installSpec !== null ? ` — ${pkg.installSpec}` : ''}
              </dd>
            </div>
            <div className="pm-field">
              <dt>{t('packageBundle')}</dt>
              <dd>{pkg.bundle ? t('packageYes') : t('packageNo')}</dd>
            </div>
            {pkg.repository !== null ? (
              <div className="pm-field">
                <dt>{t('packageRepository')}</dt>
                <dd>
                  <a href={pkg.repository} target="_blank" rel="noreferrer">
                    {trimRepository(pkg.repository)}
                  </a>
                </dd>
              </div>
            ) : null}
            {pkg.homepage !== null ? (
              <div className="pm-field">
                <dt>{t('packageHomepage')}</dt>
                <dd>
                  <a href={pkg.homepage} target="_blank" rel="noreferrer">
                    {pkg.homepage}
                  </a>
                </dd>
              </div>
            ) : null}
            {pkg.author !== null ? (
              <div className="pm-field">
                <dt>{t('packageAuthor')}</dt>
                <dd>{pkg.author}</dd>
              </div>
            ) : null}
            {pkg.keywords.length > 0 ? (
              <div className="pm-field">
                <dt>{t('packageKeywords')}</dt>
                <dd>{pkg.keywords.join(', ')}</dd>
              </div>
            ) : null}
            {pkg.reasons.length > 0 ? (
              <div className="pm-field">
                <dt>{t('packageReasons')}</dt>
                <dd>
                  <ul>
                    {pkg.reasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
          </dl>

          <h4 className="pm-groupTitle">{t('packageLoaderEntries')}</h4>
          <ul className="pm-entryList">
            {pkg.loaderEntries.length === 0 ? (
              <li className="pm-emptyState">—</li>
            ) : (
              pkg.loaderEntries.map((entry) => (
                <EntryRow
                  key={entry.entryId}
                  entry={entry}
                  t={t}
                  onSetEnabled={(enabled) => props.onSetEntryEnabled(entry.entryId, enabled)}
                />
              ))
            )}
          </ul>
        </div>
      ) : null}

      <div className="pm-cardActions">
        {pkg.canDisable ? (
          <button
            type="button"
            className="pm-toggleButton"
            disabled={pkg.loaderEntries.length === 0}
            onClick={() => void props.onSetPackageEnabled(pkg.packageName, !pkg.enabled)}
          >
            {pkg.enabled ? t('disable') : t('enable')}
          </button>
        ) : null}
        {pkg.canUninstall ? (
          <button
            type="button"
            className="pm-dangerButton"
            onClick={() => props.onRequestUninstall(pkg.packageName)}
          >
            {t('uninstall')}
          </button>
        ) : (
          <span className="pm-statusLine" data-status="failed">
            {t(uninstallBlockedKey(pkg.uninstallBlockedReason))}
          </span>
        )}
      </div>

      {props.failureMessage !== null ? (
        <p className="pm-cardError" role="alert">
          {props.failureMessage}
        </p>
      ) : null}
    </li>
  )
}

/** True when any field of the package could be relevant to the lowercased query. */
function packageMatchesQuery(pkg: PackageView, lower: string): boolean {
  if (pkg.packageName.toLowerCase().includes(lower)) return true
  if (pkg.description !== null && pkg.description.toLowerCase().includes(lower)) return true
  if (pkg.repository !== null && pkg.repository.toLowerCase().includes(lower)) return true
  if (pkg.homepage !== null && pkg.homepage.toLowerCase().includes(lower)) return true
  if (pkg.author !== null && pkg.author.toLowerCase().includes(lower)) return true
  for (const kw of pkg.keywords) {
    if (kw.toLowerCase().includes(lower)) return true
  }
  for (const entry of pkg.loaderEntries) {
    if (entry.entryId.toLowerCase().includes(lower)) return true
    if (entry.configId.toLowerCase().includes(lower)) return true
    if (entry.moduleName.toLowerCase().includes(lower)) return true
  }
  return false
}

function trimRepository(url: string): string {
  return url.replace(/^git\+/, '').replace(/\.git$/, '')
}

function installKindKey(kind: PackageView['installKind']): keyof typeof locales.zh {
  switch (kind) {
    case 'registry': return 'installKindRegistry'
    case 'link': return 'installKindLink'
    case 'file': return 'installKindFile'
    case 'git': return 'installKindGit'
    case 'tarball': return 'installKindTarball'
    case 'workspace': return 'installKindWorkspace'
    default: return 'installKindUnknown'
  }
}

function receiptKey(status: 'changed' | 'unchanged' | 'skipped' | 'failed' | 'restart-required'): keyof typeof locales.zh {
  switch (status) {
    case 'changed': return 'mutationChanged'
    case 'unchanged': return 'mutationUnchanged'
    case 'skipped': return 'mutationSkipped'
    case 'failed': return 'mutationFailed'
    case 'restart-required': return 'mutationRestartRequired'
  }
}

function uninstallBlockedKey(reason: PackageView['uninstallBlockedReason']): keyof typeof locales.zh {
  switch (reason) {
    case 'system': return 'uninstallBlockedSystem'
    case 'self': return 'uninstallBlockedSelf'
    default: return 'uninstallBlocked'
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}