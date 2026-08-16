/**
 * Confirmation modal before invoking `dsh plugin remove`. The host does
 * the actual work; this dialog only surfaces the consequence in plain
 * language and lets the user back out.
 *
 * Class names are literal `pm-*` strings (see `styles.ts`).
 */

import type { ReactNode } from 'react'
import type { locales } from '../locales.ts'

export interface UninstallDialogProps {
  packageName: string
  t: (key: keyof typeof locales.zh, params?: Record<string, unknown>) => string
  onCancel: () => void
  onConfirm: () => void
}

export function UninstallDialog({ packageName, t, onCancel, onConfirm }: UninstallDialogProps): ReactNode {
  return (
    <div className="pm-dialogBackdrop" role="dialog" aria-modal="true" aria-labelledby="pm-uninstall-title">
      <div className="pm-dialog">
        <h3 id="pm-uninstall-title">{t('uninstallConfirm')}</h3>
        <p>{t('uninstallConfirmMessage', { package: packageName })}</p>
        <div className="pm-dialogActions">
          <button type="button" onClick={onCancel}>{t('cancel')}</button>
          <button type="button" data-variant="danger" onClick={onConfirm}>{t('confirm')}</button>
        </div>
      </div>
    </div>
  )
}