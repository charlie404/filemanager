import { FileManager } from './FileManager'
import { tokensCss } from './styles'
import type { FileItem, OpenOptions } from './types'

/**
 * Find the shared `<file-manager>` instance, creating one lazily if the page did
 * not place it. The instance is a singleton — a modal is only ever open once.
 */
let cachedTag = 'file-manager'
export function setInstanceTag(tag: string): void {
  cachedTag = tag
}

function getInstance(): FileManager {
  let el = document.querySelector<FileManager>(cachedTag)
  if (!el) {
    el = document.createElement(cachedTag) as FileManager
    if (FileManager.options.endpoint) el.endpoint = FileManager.options.endpoint
    el.hidden = true
    document.body.appendChild(el)
  }
  return el
}

/**
 * Open the manager and resolve with the chosen File(s). Rejects when the user
 * closes without selecting. This is the low-level primitive behind the helpers.
 */
function requestSelection(options: OpenOptions = {}): Promise<FileItem[]> {
  const el = getInstance()
  return new Promise((resolve, reject) => {
    const onSelect = (e: Event) => {
      cleanup()
      resolve((e as CustomEvent).detail.files as FileItem[])
    }
    const onClose = () => {
      cleanup()
      reject(new Error('closed'))
    }
    const cleanup = () => {
      el.removeEventListener('selectfile', onSelect)
      el.removeEventListener('close', onClose)
      el.reset()
    }
    el.addEventListener('selectfile', onSelect)
    el.addEventListener('close', onClose)
    el.show(options)
  })
}

/** Open the picker and resolve the chosen File's URL (single). Drop-in for the
 *  visual-editor `onBrowse: (url?) => Promise<string>` contract. */
export function openFileManager(options: OpenOptions = {}): Promise<string> {
  return requestSelection({ ...options, multiple: false }).then((files) => files[0].url)
}

/** Open the picker and resolve the full chosen File (single). */
export function openFileManagerFile(options: OpenOptions = {}): Promise<FileItem> {
  return requestSelection({ ...options, multiple: false }).then((files) => files[0])
}

/** Open the picker in multiple mode and resolve all chosen Files. */
export function openFileManagerFiles(options: OpenOptions = {}): Promise<FileItem[]> {
  return requestSelection({ ...options, multiple: true })
}

// ---------------------------------------------------------------------------
// Declarative binding
// ---------------------------------------------------------------------------

const ENHANCED = '__fmBound'

function readOpts(input: HTMLElement): OpenOptions {
  const d = input.dataset
  return {
    accept: d.filemanagerAccept,
    cropRatio: d.filemanagerCropRatio,
    multiple: 'filemanagerMultiple' in d,
  }
}

function dispatchChange(input: HTMLInputElement): void {
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

const browseSvg =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>'

/** Single-value field: a text input + a browse button writing the chosen url. */
function enhanceSingle(input: HTMLInputElement): void {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'fm-browse fm-scope'
  btn.innerHTML = browseSvg
  input.insertAdjacentElement('afterend', btn)
  btn.addEventListener('click', async () => {
    try {
      const file = await openFileManagerFile({ ...readOpts(input), path: input.value || undefined })
      input.value = file.url
      dispatchChange(input)
      const altSel = input.dataset.filemanagerAltTarget
      if (altSel && file.meta?.alt) {
        const alt = document.querySelector<HTMLInputElement>(altSel)
        if (alt) {
          alt.value = file.meta.alt
          dispatchChange(alt)
        }
      }
    } catch {
      /* cancelled */
    }
  })
}

/** Multiple-value field: chips control submitting repeated `name[]` inputs. */
function enhanceMultiple(input: HTMLInputElement): void {
  const base = input.getAttribute('name') || 'files'
  const name = base.endsWith('[]') ? base : base + '[]'
  const seed = (input.value || '').split('\n').map((s) => s.trim()).filter(Boolean)
  input.removeAttribute('name') // the original input no longer submits
  input.type = 'hidden'

  const wrap = document.createElement('div')
  wrap.className = 'fm-chips fm-scope'
  input.insertAdjacentElement('afterend', wrap)

  const add = document.createElement('button')
  add.type = 'button'
  add.className = 'fm-add'
  add.setAttribute('aria-label', 'Add')
  add.innerHTML = browseSvg
  wrap.appendChild(add)

  const values = new Set<string>()
  const addValue = (url: string, label: string, thumb: string) => {
    if (values.has(url)) return
    values.add(url)
    const chip = document.createElement('span')
    chip.className = 'fm-chip'
    const img = document.createElement('img')
    img.src = thumb || url
    img.alt = ''
    const span = document.createElement('span')
    span.textContent = label || url.split('/').pop() || url
    const hidden = document.createElement('input')
    hidden.type = 'hidden'
    hidden.name = name
    hidden.value = url
    const rm = document.createElement('button')
    rm.type = 'button'
    rm.textContent = '×'
    rm.addEventListener('click', () => {
      values.delete(url)
      chip.remove()
    })
    chip.append(img, span, hidden, rm)
    wrap.insertBefore(chip, add)
  }

  add.addEventListener('click', async () => {
    try {
      const files = await openFileManagerFiles(readOpts(input))
      files.forEach((f) => addValue(f.url, f.meta?.title || f.name, f.thumbnail))
    } catch {
      /* cancelled */
    }
  })

  seed.forEach((u) => addValue(u, '', ''))
}

/** Backward-compatible Grafikart trigger: `<button data-open-file-manager="#id">`.
 *  No selector → open in manage mode (browse/organise without picking). */
function enhanceLegacyTrigger(btn: HTMLElement): void {
  btn.addEventListener('click', async (e) => {
    e.preventDefault()
    const sel = btn.getAttribute('data-open-file-manager')
    if (!sel) {
      getInstance().show({ pick: false })
      return
    }
    const target = document.querySelector<HTMLInputElement>(sel)
    try {
      const file = await openFileManagerFile({
        accept: target?.dataset.filemanagerAccept,
        cropRatio: target?.dataset.filemanagerCropRatio,
        path: target?.value || undefined,
      })
      if (target) {
        target.value = file.url
        dispatchChange(target)
      }
    } catch {
      /* cancelled */
    }
  })
}

function once<T extends HTMLElement>(el: T, fn: (el: T) => void): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((el as any)[ENHANCED]) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(el as any)[ENHANCED] = true
  fn(el)
}

let stylesInjected = false
function injectStyles(): void {
  if (stylesInjected) return
  stylesInjected = true
  const style = document.createElement('style')
  style.textContent = `
${tokensCss.replace(/:host, /g, '')}
.fm-chips{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center}
.fm-chip{display:inline-flex;align-items:center;gap:.4rem;padding:.2rem .3rem;background:var(--fm-surface-2);border:1px solid var(--fm-border);border-radius:var(--fm-radius-field);font-size:.8rem;color:var(--fm-fg)}
.fm-chip img{width:24px;height:24px;object-fit:cover;border-radius:4px;flex:0 0 auto}
.fm-chip span{max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fm-chip button{border:0;background:transparent;cursor:pointer;color:var(--fm-muted);font-size:1.05rem;line-height:1;padding:0 .15rem}
.fm-chip button:hover{color:var(--fm-danger)}
.fm-add,.fm-browse{display:inline-grid;place-items:center;width:34px;height:34px;border:1px solid var(--fm-border);border-radius:var(--fm-radius-field);background:var(--fm-surface-2);color:var(--fm-muted);cursor:pointer}
.fm-add{border-style:dashed}
.fm-add:hover,.fm-browse:hover{border-color:var(--fm-primary);color:var(--fm-primary)}
`
  document.head.appendChild(style)
}

/**
 * Wire every `[data-filemanager]` field (and legacy `[data-open-file-manager]`
 * triggers) under `root`. Idempotent — safe to call after dynamic DOM updates.
 */
export function bindFileManagers(root: ParentNode = document): void {
  injectStyles()
  root.querySelectorAll<HTMLInputElement>('[data-filemanager]').forEach((input) =>
    once(input, (el) =>
      'filemanagerMultiple' in el.dataset ? enhanceMultiple(el) : enhanceSingle(el),
    ),
  )
  root
    .querySelectorAll<HTMLElement>('[data-open-file-manager]')
    .forEach((btn) => once(btn, enhanceLegacyTrigger))
}

/** Register the element and auto-bind declarative fields once the DOM is ready. */
export function autoInit(tag = 'file-manager', options = {}): void {
  FileManager.register(tag, options)
  setInstanceTag(tag)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bindFileManagers())
  } else {
    bindFileManagers()
  }
}
