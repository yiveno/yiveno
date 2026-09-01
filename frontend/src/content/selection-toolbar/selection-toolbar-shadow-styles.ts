import brandCss from '@yiveno/design-tokens/css/brand.css?raw'
import semanticColorsCss from '@yiveno/design-tokens/css/semantic-colors.css?raw'

/** Shadow 内无法继承页面 token；将 :root 换成 :host 后注入 closed shadow。 */
export function scopeDesignTokensToShadowHost(rawCss: string): string {
  return rawCss.replace(/:root/g, ':host')
}

/**
 * 划词浮层组件样式（仅 var()，禁止硬编码品牌 hex）。
 * 与 extension App* 控件气质对齐：sage accent、纸面底、墨影。
 */
export const SELECTION_TOOLBAR_COMPONENT_CSS = `
  .shell {
    pointer-events: auto;
    transform: translateX(-50%);
    display: grid;
    gap: 6px;
    max-width: min(320px, calc(100vw - 16px));
  }
  .toolbar {
    display: inline-flex;
    align-items: center;
    padding: 2px;
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    background: var(--surface-accent-soft);
    box-shadow: var(--shadow-ink-sm);
  }
  .action-button,
  .status-button {
    margin: 0;
    padding: 6px 12px;
    border: none;
    border-radius: var(--radius-full);
    font: 600 13px/1.2 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: var(--accent-hover);
    background: transparent;
    cursor: pointer;
    white-space: nowrap;
  }
  .action-button--icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 0;
  }
  .action-icon {
    display: block;
    flex-shrink: 0;
  }
  .action-button:hover:not(:disabled),
  .status-button:hover:not(:disabled) {
    background: var(--yiveno-primary-alpha-10);
  }
  .action-button:disabled,
  .status-button:disabled,
  .note-input:disabled {
    cursor: wait;
    opacity: var(--disabled-opacity);
  }
  .divider {
    width: 1px;
    align-self: stretch;
    margin: 4px 0;
    background: var(--border);
  }
  .status-button--saved {
    color: var(--sage-dark);
    cursor: default;
    opacity: 1;
  }
  .status-button--error {
    color: var(--yiveno-semantic-error);
  }
  .saved-feedback {
    display: none;
    min-width: 200px;
    max-width: min(300px, calc(100vw - 16px));
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface-accent-soft);
    box-shadow: var(--shadow-ink-sm);
  }
  .saved-feedback.is-open {
    display: grid;
    gap: 4px;
  }
  .saved-preview {
    margin: 0;
    font: 500 12px/1.35 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
      sans-serif;
    color: var(--sage-dark);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }
  .saved-hint {
    margin: 0;
    font: 500 11px/1.35 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
      sans-serif;
    color: var(--accent-hover);
  }
  .saved-recall-button {
    justify-self: start;
    margin-top: 2px;
    padding: 6px 12px;
    border: none;
    border-radius: var(--radius-full);
    font: 600 12px/1.2 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
      sans-serif;
    color: var(--on-accent);
    background: var(--accent);
    cursor: pointer;
  }
  .saved-recall-button:hover {
    background: var(--accent-hover);
  }
  .saved-recall-button:disabled {
    cursor: wait;
    opacity: var(--disabled-opacity);
  }
  .note-panel {
    display: none;
    min-width: 220px;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface-accent-soft);
    box-shadow: var(--shadow-ink-sm);
  }
  .note-panel.is-open {
    display: block;
  }
  .note-input {
    box-sizing: border-box;
    width: 100%;
    min-height: 56px;
    margin: 0;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    resize: vertical;
    font: 13px/1.4 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: var(--on-surface);
    background: var(--surface-white);
  }
  .note-input:focus {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }
  .is-hidden {
    display: none !important;
  }
`

/** 划词 Shadow 浮层完整样式（design tokens + 组件规则）。 */
export function getSelectionToolbarShadowStyles(): string {
  return [
    scopeDesignTokensToShadowHost(brandCss),
    scopeDesignTokensToShadowHost(semanticColorsCss),
    SELECTION_TOOLBAR_COMPONENT_CSS
  ].join('\n')
}
