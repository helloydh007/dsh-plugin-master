/**
 * Plugin master styles, delivered as a plain CSS string. We deliberately
 * do NOT use CSS Modules: tsdown's module-CSS pipeline emits a class-name
 * map as the default export (not the CSS text), so injecting that map's
 * string form yields "[object Object]" and the plugin renders unstyled.
 * Shipping the styles as a string with stable `pm-*` class names keeps the
 * build deterministic and the injection trivially correct.
 */

export const pluginMasterCss = `
.pm-section {
  width: 100%;
  max-width: 880px;
  color: var(--dsw-alias-label-primary, #1f2328);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pm-header { display: flex; flex-direction: column; gap: 6px; }

.pm-headerTitle {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.pm-headerIntro {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-tertiary, #57606a);
}

.pm-devMode {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-top: 2px;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-l2, #d0d7de);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2, #f6f8fa);
  cursor: pointer;
}

.pm-devMode input {
  margin-top: 3px;
  accent-color: var(--dsw-alias-state-business-primary, #0969da);
}

.pm-devMode span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pm-devMode strong {
  font-size: 13px;
  font-weight: 600;
}

.pm-devMode em {
  font-style: normal;
  font-size: 11px;
  color: var(--dsw-alias-state-business-primary, #0969da);
}

.pm-devMode small {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary, #57606a);
}

.pm-tagQuarantined {
  background: color-mix(in srgb, #8250df 14%, transparent);
  color: #8250df;
}

.pm-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.pm-search {
  position: relative;
  display: flex;
  flex: 1 1 320px;
  min-width: 220px;
  align-items: center;
}

.pm-searchInput {
  width: 100%;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, #d0d7de);
  background: var(--dsw-alias-bg-layer-1, #ffffff);
  color: var(--dsw-alias-label-primary, #1f2328);
  font: inherit;
  padding: 0 12px 0 36px;
  outline: none;
  font-size: 13px;
  box-sizing: border-box;
}

.pm-searchInput:focus-visible {
  border-color: var(--dsw-alias-state-business-primary, #0969da);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary, #0969da) 18%, transparent);
}

.pm-searchIcon {
  position: absolute;
  left: 12px;
  pointer-events: none;
  color: var(--dsw-alias-label-tertiary, #57606a);
}

.pm-toolbarButton {
  height: 32px;
  padding: 0 12px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2, #d0d7de);
  background: var(--dsw-alias-bg-layer-2, #f6f8fa);
  color: var(--dsw-alias-label-primary, #1f2328);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.pm-toolbarButton:hover {
  background: var(--dsw-alias-bg-layer-3, #eef1f4);
}

.pm-counters {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, #57606a);
  font-variant-numeric: tabular-nums;
}

.pm-counters strong {
  color: var(--dsw-alias-label-primary, #1f2328);
  font-weight: 600;
}

.pm-groups { display: flex; flex-direction: column; gap: 18px; }
.pm-group { display: flex; flex-direction: column; gap: 10px; }

.pm-groupHeader {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 0 4px;
}

.pm-groupTitle {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.pm-groupHint {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, #57606a);
  margin: 0;
}

.pm-cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 12px;
}

.pm-card {
  border: 1px solid var(--dsw-alias-border-l2, #d0d7de);
  background: var(--dsw-alias-bg-layer-3, #ffffff);
  border-radius: 10px;
  min-width: 0;
  overflow: hidden;
}

.pm-card[data-open="true"] {
  border-color: var(--dsw-alias-border-l1, #afb8c1);
  box-shadow: 0 1px 3px rgba(31, 35, 40, 0.08);
}

.pm-cardHeader {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: transparent;
  border: 0;
  width: 100%;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
}

.pm-cardHeader:hover {
  background: var(--dsw-alias-bg-layer-2, #f6f8fa);
}

.pm-cardTitle {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.pm-cardTitle strong {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pm-cardTitle span {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, #57606a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pm-cardTags {
  display: flex;
  gap: 6px;
  align-items: center;
  flex: none;
}

.pm-tag {
  font-size: 11px;
  line-height: 16px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-2, #f6f8fa);
  color: var(--dsw-alias-label-secondary, #424a53);
}

.pm-tagSystem {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #0969da) 14%, transparent);
  color: var(--dsw-alias-state-business-primary, #0969da);
}

.pm-tagUser {
  background: color-mix(in srgb, #bf8700 14%, transparent);
  color: #9a6700;
}

.pm-tagEnabled {
  background: color-mix(in srgb, #1a7f37 14%, transparent);
  color: #1a7f37;
}

.pm-tagDisabled {
  background: color-mix(in srgb, #cf222e 14%, transparent);
  color: #cf222e;
}

.pm-cardBody {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid var(--dsw-alias-border-l2, #d0d7de);
}

.pm-field {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 8px;
  font-size: 12px;
  line-height: 18px;
  align-items: baseline;
}

.pm-field dt {
  margin: 0;
  color: var(--dsw-alias-label-tertiary, #57606a);
}

.pm-field dd {
  margin: 0;
  word-break: break-word;
}

.pm-field dd ul { margin: 0; padding-left: 16px; }
.pm-field a {
  color: var(--dsw-alias-state-business-primary, #0969da);
  text-decoration: none;
}
.pm-field a:hover { text-decoration: underline; }

.pm-entryList {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pm-entry {
  border: 1px solid var(--dsw-alias-border-l2, #d0d7de);
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--dsw-alias-bg-layer-1, #ffffff);
}

.pm-entryHead {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.pm-entryId {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
}

.pm-entryMeta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, #57606a);
  flex-wrap: wrap;
}

.pm-entryMeta code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  background: var(--dsw-alias-bg-layer-2, #f6f8fa);
  padding: 1px 4px;
  border-radius: 3px;
}

.pm-entryControls {
  display: flex;
  gap: 6px;
  align-items: center;
  flex: none;
}

.pm-toggleButton {
  font: inherit;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid var(--dsw-alias-border-l2, #d0d7de);
  padding: 2px 8px;
  cursor: pointer;
  background: var(--dsw-alias-bg-layer-2, #f6f8fa);
  color: var(--dsw-alias-label-primary, #1f2328);
}

.pm-toggleButton[data-variant="danger"] {
  border-color: color-mix(in srgb, #cf222e 30%, transparent);
  color: #cf222e;
}

.pm-toggleButton[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}

.pm-cardActions {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  border-top: 1px solid var(--dsw-alias-border-l2, #d0d7de);
  background: var(--dsw-alias-bg-layer-2, #f6f8fa);
}

.pm-dangerButton {
  font: inherit;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, #cf222e 35%, transparent);
  background: var(--dsw-alias-bg-layer-3, #ffffff);
  color: #cf222e;
  padding: 4px 10px;
  cursor: pointer;
}

.pm-dangerButton[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

.pm-emptyState {
  font-size: 13px;
  color: var(--dsw-alias-label-tertiary, #57606a);
  margin: 0;
  padding: 8px 4px;
}

.pm-failure {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 13px;
  color: var(--dsw-alias-state-error-primary, #cf222e);
}

.pm-failure button {
  border: 1px solid var(--dsw-alias-border-l2, #d0d7de);
  background: var(--dsw-alias-bg-layer-1, #ffffff);
  color: inherit;
  font: inherit;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
}

.pm-dialogBackdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.pm-dialog {
  background: var(--dsw-alias-bg-layer-1, #ffffff);
  border-radius: 10px;
  padding: 20px;
  width: 420px;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pm-dialog h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.pm-dialog p {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary, #424a53);
}

.pm-dialogActions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.pm-dialogActions button {
  border: 1px solid var(--dsw-alias-border-l2, #d0d7de);
  background: var(--dsw-alias-bg-layer-2, #f6f8fa);
  color: var(--dsw-alias-label-primary, #1f2328);
  font: inherit;
  border-radius: 6px;
  padding: 4px 12px;
  cursor: pointer;
}

.pm-dialogActions button[data-variant="danger"] {
  border-color: color-mix(in srgb, #cf222e 50%, transparent);
  background: #cf222e;
  color: #ffffff;
}

.pm-statusLine {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, #57606a);
}

.pm-statusLine[data-status="failed"] { color: #cf222e; }
.pm-statusLine[data-status="restart-required"] { color: #9a6700; }
.pm-statusLine[data-status="changed"] { color: #1a7f37; }

/* 卡片内错误提示:出现在用户点击的卡片底部,而不是只在页面顶部。 */
.pm-cardError {
  margin: 0;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 18px;
  color: #cf222e;
  background: color-mix(in srgb, #cf222e 8%, transparent);
  border-top: 1px solid color-mix(in srgb, #cf222e 25%, transparent);
  word-break: break-word;
}

.pm-visuallyHidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* 操作失败/待重启提示弹窗 */
.pm-receiptList {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 40vh;
  overflow-y: auto;
}

.pm-receiptList li {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-l2, #d0d7de);
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2, #f6f8fa);
}

.pm-receiptList li strong {
  font-size: 12px;
  word-break: break-all;
}

.pm-receiptList li .pm-tag {
  align-self: flex-start;
}

.pm-receiptMessage {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary, #424a53);
  word-break: break-word;
}

@media (max-width: 680px) {
  .pm-cards { grid-template-columns: minmax(0, 1fr); }
}
`