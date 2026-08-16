/**
 * One loader entry row inside a package card. Shows the entry id, config
 * id, module name, current phase, and an enable/disable toggle that
 * calls back into the host with the entry id. The row itself is purely
 * presentational — the parent supplies the toggle callback so the parent
 * can decide whether to update one entry or the whole package.
 *
 * Class names are literal `pm-*` strings (see `styles.ts`).
 */

import type { ReactNode } from 'react'
import type { LoaderEntryView } from '../../host/types.ts'
import type { locales } from '../locales.ts'

export interface EntryRowProps {
  entry: LoaderEntryView
  t: (key: keyof typeof locales.zh, params?: Record<string, unknown>) => string
  onSetEnabled: (enabled: boolean) => Promise<void>
}

export function EntryRow({ entry, t, onSetEnabled }: EntryRowProps): ReactNode {
  return (
    <li className="pm-entry">
      <div className="pm-entryHead">
        <span className="pm-entryId">{entry.entryId}</span>
        <div className="pm-entryControls">
          <span className={`pm-tag ${entry.enabled ? 'pm-tagEnabled' : 'pm-tagDisabled'}`}>
            {entry.enabled ? t('enabledTag') : t('disabledTag')}
          </span>
          {entry.protected ? (
            <span className="pm-tag" title={entry.protectionReason ?? t('protectedReason')}>{t('protectedReason')}</span>
          ) : (
            <button
              type="button"
              className="pm-toggleButton"
              data-variant={entry.enabled ? 'danger' : undefined}
              onClick={() => void onSetEnabled(!entry.enabled)}
            >
              {entry.enabled ? t('disable') : t('enable')}
            </button>
          )}
        </div>
      </div>
      <div className="pm-entryMeta">
        <span>
          {t('configId')}: <code>{entry.configId}</code>
        </span>
        <span>
          {t('moduleName')}: <code>{entry.moduleName}</code>
        </span>
        <span>
          {t('status')}: <code>{phaseLabel(entry.phase, t)}</code>
        </span>
      </div>
      {entry.error !== null ? (
        <p className="pm-statusLine" data-status="failed">{entry.error}</p>
      ) : null}
    </li>
  )
}

function phaseLabel(phase: LoaderEntryView['phase'], t: EntryRowProps['t']): string {
  if (phase === null) return t('phaseUnobserved')
  switch (phase) {
    case 'pending': return t('phasePending')
    case 'loading': return t('phaseLoading')
    case 'active': return t('phaseActive')
    case 'failed': return t('phaseFailed')
    case 'unloading': return t('phaseUnloading')
  }
}