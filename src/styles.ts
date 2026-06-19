import { css, unsafeCSS } from 'lit'

/**
 * Design tokens — the theming contract (ADR 0002).
 *
 * Each token reads daisyUI's semantic variable first and only falls back to a
 * private default (`--_fmd-*`) when daisyUI is absent. The dark `@media` block
 * flips ONLY those private defaults, so when daisyUI IS present the active
 * `data-theme` always wins and the OS preference is ignored. Hosts can override
 * any `--fm-*` directly.
 */
const TOKENS = `
  --fm-surface:     var(--color-base-100, var(--_fmd-surface));
  --fm-surface-2:   var(--color-base-200, var(--_fmd-surface-2));
  --fm-surface-3:   var(--color-base-300, var(--_fmd-surface-3));
  --fm-fg:          var(--color-base-content, var(--_fmd-fg));
  --fm-primary:     var(--color-primary, var(--_fmd-primary));
  --fm-primary-fg:  var(--color-primary-content, var(--_fmd-primary-fg));
  --fm-danger:      var(--color-error, var(--_fmd-danger));
  --fm-danger-fg:   var(--color-error-content, #fff);
  --fm-radius:      var(--radius-box, 0.75rem);
  --fm-radius-field:var(--radius-field, 0.5rem);
  --fm-border:      color-mix(in oklab, var(--fm-fg) 16%, transparent);
  --fm-muted:       color-mix(in oklab, var(--fm-fg) 62%, transparent);
  --fm-hover:       color-mix(in oklab, var(--fm-fg) 7%, transparent);
  --fm-overlay:     rgb(0 0 0 / 0.55);

  --_fmd-surface: #ffffff;
  --_fmd-surface-2: #f4f4f7;
  --_fmd-surface-3: #e9e9ef;
  --_fmd-fg: #1f2430;
  --_fmd-primary: #2563eb;
  --_fmd-primary-fg: #ffffff;
  --_fmd-danger: #dc2626;
`

const TOKENS_DARK = `
  --_fmd-surface: #1d2128;
  --_fmd-surface-2: #232832;
  --_fmd-surface-3: #2d333f;
  --_fmd-fg: #e6e8ec;
  --_fmd-primary: #3b82f6;
  --_fmd-primary-fg: #ffffff;
  --_fmd-danger: #f05252;
`

/** Token block as a plain string, for the light-DOM chips stylesheet. */
export const tokensCss = `:host, .fm-scope { ${TOKENS} }
@media (prefers-color-scheme: dark) { :host, .fm-scope { ${TOKENS_DARK} } }`

export const elementStyles = css`
  :host {
    ${unsafeCSS(TOKENS)}
    --fm-forced: light dark;
    font-family:
      system-ui,
      -apple-system,
      'Segoe UI',
      Roboto,
      sans-serif;
    color: var(--fm-fg);
    box-sizing: border-box;
  }
  :host([hidden]) {
    display: none;
  }
  @media (prefers-color-scheme: dark) {
    :host {
      ${unsafeCSS(TOKENS_DARK)}
    }
  }
  /* explicit theme override */
  :host([theme='light']) {
    ${unsafeCSS(TOKENS)}
  }
  :host([theme='dark']) {
    ${unsafeCSS(TOKENS_DARK)}
  }
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  .overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: grid;
    place-items: center;
    padding: clamp(0px, 3vw, 2rem);
    background: var(--fm-overlay);
    backdrop-filter: blur(2px);
    animation: fm-fade 0.15s ease;
  }
  @keyframes fm-fade {
    from {
      opacity: 0;
    }
  }

  .modal {
    display: flex;
    flex-direction: column;
    width: min(1100px, 100%);
    height: min(760px, 100%);
    background: var(--fm-surface);
    color: var(--fm-fg);
    border: 1px solid var(--fm-border);
    border-radius: var(--fm-radius);
    box-shadow: 0 24px 60px -12px rgb(0 0 0 / 0.45);
    overflow: hidden;
  }

  header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--fm-border);
    background: var(--fm-surface);
  }
  header h2 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    flex: 0 0 auto;
  }
  .spacer {
    flex: 1 1 auto;
  }
  .search {
    flex: 1 1 auto;
    max-width: 320px;
  }

  .body {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
  }
  .sidebar {
    flex: 0 0 220px;
    overflow: auto;
    border-right: 1px solid var(--fm-border);
    background: var(--fm-surface);
  }
  /* sticky action bar: full-bleed bottom border, mirroring the main toolbar */
  .sidebar-head {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 0.5rem;
    background: var(--fm-surface);
    border-bottom: 1px solid var(--fm-border);
  }
  .sidebar-body {
    padding: 0.5rem;
  }
  .main {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--fm-border);
    flex-wrap: wrap;
  }
  /* a native <select> renders ~2px taller than a .btn for the same padding, which
     made the toolbar taller than the sidebar "New folder" row and offset their
     bottom borders — trim a pixel so the controls (and the two borders) line up */
  .toolbar select.input {
    padding-block: calc(0.4rem - 1px);
  }
  .content {
    position: relative;
    flex: 1 1 auto;
    overflow: auto;
    padding: 0.75rem;
  }
  footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border-top: 1px solid var(--fm-border);
  }

  /* tree */
  .tree {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 0.875rem;
  }
  .tree li {
    margin: 1px 0;
  }
  .tree button {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    padding: 0.35rem 0.5rem;
    border: 0;
    border-radius: var(--fm-radius-field);
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
    font: inherit;
  }
  .tree button:hover {
    background: var(--fm-hover);
  }
  .tree button[aria-current='true'] {
    background: var(--fm-primary);
    color: var(--fm-primary-fg);
  }
  .tree .twisty {
    flex: 0 0 auto;
    display: inline-grid;
    place-items: center;
    width: 16px;
    height: 16px;
    margin: -2px 0;
    border-radius: 4px;
    opacity: 0.55;
    transition:
      transform 0.15s ease,
      opacity 0.1s,
      background 0.1s;
  }
  .tree .twisty:hover {
    opacity: 1;
    background: color-mix(in oklab, currentColor 16%, transparent);
  }
  .tree .twisty[aria-expanded='true'] {
    transform: rotate(90deg);
  }
  .tree .twisty-spacer {
    flex: 0 0 auto;
    width: 16px;
  }
  /* the folder name takes the remaining width and middle-truncates inside it */
  .tree fm-trunc {
    flex: 1 1 auto;
    min-width: 0;
  }
  /* delete action — only rendered on the active folder (see renderFolderNode) */
  .tree .del {
    flex: 0 0 auto;
    display: inline-grid;
    place-items: center;
    width: 18px;
    height: 18px;
    margin: -2px -2px -2px 0;
    border-radius: 4px;
    opacity: 0.65;
    transition:
      opacity 0.1s,
      background 0.1s;
  }
  .tree .del:hover {
    opacity: 1;
    background: color-mix(in oklab, currentColor 18%, transparent);
  }

  /* sidebar "New folder" action, pinned in the sticky head above the tree */
  .sidebar .newfolder {
    width: 100%;
    justify-content: flex-start;
  }
  .tree .drop,
  .btn.drop {
    outline: 2px dashed var(--fm-primary);
    outline-offset: -2px;
    background: color-mix(in oklab, var(--fm-primary) 14%, transparent);
    color: var(--fm-fg);
  }

  /* grid + rows */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.625rem;
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .item {
    position: relative;
    border: 1px solid var(--fm-border);
    border-radius: var(--fm-radius-field);
    background: var(--fm-surface-2);
    cursor: pointer;
    overflow: hidden;
    user-select: none;
  }
  .item:hover {
    border-color: var(--fm-primary);
  }
  /* the thumbnail must not steal the drag — the whole item is the drag source */
  .item img {
    -webkit-user-drag: none;
    user-drag: none;
  }
  .item[data-dragging='true'] {
    opacity: 0.5;
  }
  .item[aria-selected='true'] {
    border-color: var(--fm-primary);
    outline: 2px solid var(--fm-primary);
    outline-offset: -1px;
  }
  .item[data-disabled='true'] {
    opacity: 0.4;
    pointer-events: none;
    filter: grayscale(1);
  }
  .grid .thumb {
    aspect-ratio: 1;
    width: 100%;
    object-fit: cover;
    display: block;
    background: var(--fm-surface-3);
  }
  .grid .label {
    padding: 0.35rem 0.45rem;
    font-size: 0.75rem;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .file-glyph {
    background: var(--fm-surface-3);
  }
  .grid .file-glyph {
    display: grid;
    place-items: center;
    padding: 17%;
  }
  .rows .file-glyph {
    display: grid;
    place-items: center;
    padding: 3px;
  }
  .item .check {
    position: absolute;
    top: 6px;
    left: 6px;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    border: 2px solid #fff;
    background: rgb(0 0 0 / 0.35);
    display: grid;
    place-items: center;
    color: #fff;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .item:hover .check,
  .item[aria-selected='true'] .check,
  :host([multiple]) .check {
    opacity: 1;
  }
  .item[aria-selected='true'] .check {
    background: var(--fm-primary);
    border-color: var(--fm-primary);
  }
  .item .actions {
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .item:hover .actions {
    opacity: 1;
  }
  .item .actions button {
    width: 26px;
    height: 26px;
    border: 0;
    border-radius: 6px;
    background: rgb(0 0 0 / 0.55);
    color: #fff;
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  .item .actions button:hover {
    background: var(--fm-primary);
  }

  /* rows layout */
  .rows .item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.35rem 0.5rem;
    background: transparent;
    border-color: transparent;
  }
  .rows .item:hover {
    background: var(--fm-hover);
  }
  .rows .thumb {
    width: 38px;
    height: 38px;
    border-radius: 6px;
    object-fit: cover;
    flex: 0 0 auto;
    background: var(--fm-surface-3);
  }
  .rows .label {
    flex: 1 1 auto;
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rows .size {
    color: var(--fm-muted);
    font-size: 0.75rem;
    flex: 0 0 auto;
  }
  .rows .actions {
    position: static;
    opacity: 1;
  }
  .rows .actions button {
    background: transparent;
    color: var(--fm-muted);
  }
  .rows .actions button:hover {
    color: var(--fm-primary);
    background: var(--fm-hover);
  }

  /* buttons + inputs */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.7rem;
    font: inherit;
    font-size: 0.85rem;
    border: 1px solid var(--fm-border);
    border-radius: var(--fm-radius-field);
    background: var(--fm-surface-2);
    color: inherit;
    cursor: pointer;
    white-space: nowrap;
  }
  .btn:hover {
    background: var(--fm-hover);
  }
  .btn.primary {
    background: var(--fm-primary);
    border-color: var(--fm-primary);
    color: var(--fm-primary-fg);
  }
  .btn.primary:hover {
    filter: brightness(1.05);
  }
  .btn.ghost {
    background: transparent;
    border-color: transparent;
  }
  .btn.ghost:hover {
    background: var(--fm-hover);
  }
  .btn.danger {
    color: var(--fm-danger);
  }
  .btn.solid-danger {
    background: var(--fm-danger);
    border-color: var(--fm-danger);
    color: var(--fm-danger-fg);
  }
  .btn.solid-danger:hover {
    filter: brightness(1.05);
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn.icon {
    padding: 0.4rem;
  }
  .input {
    width: 100%;
    padding: 0.4rem 0.6rem;
    font: inherit;
    font-size: 0.85rem;
    color: inherit;
    background: var(--fm-surface-2);
    border: 1px solid var(--fm-border);
    border-radius: var(--fm-radius-field);
  }
  .input:focus {
    outline: 2px solid var(--fm-primary);
    outline-offset: -1px;
    border-color: var(--fm-primary);
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--fm-border);
    border-radius: var(--fm-radius-field);
    overflow: hidden;
  }
  .seg button {
    border: 0;
    background: transparent;
    color: inherit;
    padding: 0.35rem 0.55rem;
    cursor: pointer;
    font: inherit;
    font-size: 0.8rem;
  }
  .seg button[aria-pressed='true'] {
    background: var(--fm-primary);
    color: var(--fm-primary-fg);
  }

  .empty {
    display: grid;
    place-content: center;
    gap: 0.25rem;
    height: 100%;
    text-align: center;
    color: var(--fm-muted);
  }
  .empty svg {
    margin: 0 auto;
    opacity: 0.5;
  }
  .dropzone {
    position: absolute;
    inset: 0.5rem;
    border: 2px dashed var(--fm-primary);
    border-radius: var(--fm-radius);
    background: color-mix(in oklab, var(--fm-primary) 12%, transparent);
    display: grid;
    place-items: center;
    font-weight: 600;
    color: var(--fm-fg);
    pointer-events: none;
    z-index: 5;
  }
  .spinner {
    width: 26px;
    height: 26px;
    border: 3px solid var(--fm-border);
    border-top-color: var(--fm-primary);
    border-radius: 50%;
    animation: fm-spin 0.7s linear infinite;
  }
  .loading {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: color-mix(in oklab, var(--fm-surface) 60%, transparent);
    z-index: 4;
  }
  @keyframes fm-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.85rem;
    color: var(--fm-muted);
    /* stay on one line: take the toolbar's free width and scroll horizontally
       (auto-scrolled to the current folder) instead of wrapping */
    flex: 1 1 0;
    min-width: 0;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }
  .breadcrumb::-webkit-scrollbar {
    display: none;
  }
  /* keep the chevron separators from being squeezed to nothing when the trail
     overflows (the buttons don't shrink, so all shrink pressure lands on these) */
  .breadcrumb > svg {
    flex: 0 0 auto;
  }
  .breadcrumb button {
    flex: 0 0 auto;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
    padding: 0.15rem 0.3rem;
    border-radius: 5px;
  }
  .breadcrumb button:hover {
    background: var(--fm-hover);
    color: var(--fm-fg);
  }
  /* cap each segment so a long folder name middle-truncates instead of stretching
     the toolbar (same treatment as the sidebar). inline-block so it sizes to its
     own content up to the cap, rather than collapsing inside the shrink-to-fit button */
  .breadcrumb fm-trunc {
    display: inline-block;
    max-width: 13rem;
    vertical-align: middle;
  }

  /* crop + meta panels share the .pane overlay inside the modal */
  .pane {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    background: var(--fm-surface);
  }
  .pane .pane-body {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
  }
  .crop-stage {
    flex: 1 1 auto;
    min-width: 0;
    background: #111;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .crop-stage img {
    max-width: 100%;
    display: block;
  }
  .crop-side,
  .meta-side {
    flex: 0 0 260px;
    border-left: 1px solid var(--fm-border);
    padding: 1rem;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .ratios {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .field label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }
  .field .hint {
    font-size: 0.72rem;
    color: var(--fm-muted);
    margin-top: 0.2rem;
  }
  .meta-preview {
    width: 100%;
    border-radius: var(--fm-radius-field);
    border: 1px solid var(--fm-border);
    background: var(--fm-surface-3);
    aspect-ratio: 16/10;
    object-fit: contain;
  }
  textarea.input {
    resize: vertical;
    min-height: 60px;
  }

  /* themed confirm / prompt dialog (replaces native alert/confirm/prompt) */
  .dialog-backdrop {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 0.45);
    animation: fm-fade 0.12s ease;
  }
  .dialog-box {
    width: min(400px, 92%);
    background: var(--fm-surface);
    color: var(--fm-fg);
    border: 1px solid var(--fm-border);
    border-radius: var(--fm-radius);
    box-shadow: 0 20px 50px -12px rgb(0 0 0 / 0.5);
    padding: 1.1rem 1.2rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  .dialog-box h3 {
    margin: 0;
    font-size: 0.98rem;
    font-weight: 600;
  }
  .dialog-box h3 .dialog-sub {
    margin-left: 0.4rem;
    font-weight: 400;
    color: var(--fm-muted);
  }
  .dialog-box p {
    margin: 0;
    font-size: 0.88rem;
    color: var(--fm-muted);
    line-height: 1.4;
  }
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.2rem;
  }

  /* hidden probe: lets JS read resolved theme colours for the drag-count badge */
  .fm-probe {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
    visibility: hidden;
    background: var(--fm-surface);
    color: var(--fm-fg);
    border-top: 0 solid var(--fm-primary);
    outline: 0 solid var(--fm-primary-fg);
  }
`
