import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit'
import { property, state } from 'lit/decorators.js'
import { elementStyles } from './styles'
import { icons } from './icons'
import { createRestApi } from './api'
import { resolveDict, type Dict } from './i18n'
import { acceptMatches, formatBytes, isImage } from './utils'
import { fileGlyph } from './filetypes'
import './crop'
import type { CropApplyDetail } from './crop'
import type {
  FileItem,
  FileManagerApi,
  Folder,
  Layout,
  OpenOptions,
  SelectDetail,
  SortKey,
  ThemeMode,
} from './types'

export interface RegisterOptions {
  endpoint?: string
  headers?: Record<string, string>
  credentials?: RequestCredentials
  lang?: string
  /** Provide a full or partial custom backend, overriding the REST client. */
  api?: Partial<FileManagerApi>
}

type Pane = null | 'crop' | 'meta'

interface DialogState {
  kind: 'confirm' | 'prompt'
  title: string
  message?: string
  value: string
  danger?: boolean
  resolve: (result: boolean | string | null) => void
}

/**
 * `<file-manager>` — a modal media browser. One shared instance is placed in the
 * page; `show(options)` configures it per use (accept / multiple / cropRatio) and
 * `selectfile` reports the chosen File(s). See CONTEXT.md and docs/adr.
 */
export class FileManager extends LitElement {
  static override styles = elementStyles

  /** Global registration options, set by `register()`. */
  static options: RegisterOptions = {}

  @property() endpoint = ''
  @property({ reflect: true }) layout: Layout = 'grid'
  @property({ type: Boolean, reflect: true }) readonly = false
  @property({ type: Boolean, reflect: true }) multiple = false
  @property() accept = ''
  @property({ attribute: 'crop-ratio' }) cropRatio: string | number = ''
  @property({ reflect: true }) theme: ThemeMode = 'auto'
  @property() override lang = ''

  @state() private open = false
  @state() private pick = true
  @state() private folders: Folder[] = []
  @state() private files: FileItem[] = []
  @state() private currentFolder: string | null = null
  @state() private selected = new Set<string>()
  @state() private loading = false
  @state() private uploading = false
  @state() private search = ''
  @state() private sortKey: SortKey = 'name'
  @state() private dragOver = false
  @state() private pane: Pane = null
  @state() private active: FileItem | null = null
  @state() private copiedId: string | null = null
  @state() private error = ''
  @state() private metaAlt = ''
  @state() private metaTitle = ''
  @state() private metaName = ''
  @state() private dialog: DialogState | null = null

  private api!: FileManagerApi
  private dict!: Dict
  private loaded = false
  private dragFileIds: string[] = []

  override connectedCallback(): void {
    super.connectedCallback()
    this.dict = resolveDict(this.lang || FileManager.options.lang)
    this.api = this.buildApi()
    if (!this.hasAttribute('theme')) this.theme = 'auto'
    this.hidden = !this.open
  }

  override willUpdate(changed: PropertyValues): void {
    if (changed.has('lang')) {
      this.dict = resolveDict(this.lang || FileManager.options.lang)
    }
  }

  private buildApi(): FileManagerApi {
    const endpoint = this.endpoint || FileManager.options.endpoint || ''
    const rest = createRestApi({
      endpoint,
      headers: FileManager.options.headers,
      credentials: FileManager.options.credentials,
    })
    // merge any custom overrides supplied at registration
    return { ...rest, ...(FileManager.options.api ?? {}) } as FileManagerApi
  }

  // ---- public API -------------------------------------------------------

  /** Open the manager, configuring it for this use. */
  show(options: OpenOptions & { pick?: boolean } = {}): void {
    if (options.accept !== undefined) this.accept = options.accept
    if (options.multiple !== undefined) this.multiple = options.multiple
    if (options.cropRatio !== undefined) this.cropRatio = options.cropRatio
    this.pick = options.pick ?? true
    this.selected = new Set()
    this.error = ''
    this.open = true
    this.hidden = false
    if (!this.loaded) void this.load()
  }

  /** Close the manager and emit `close`. */
  close(): void {
    this.open = false
    this.hidden = true
    this.pane = null
    this.active = null
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))
  }

  /** Clear per-open configuration so the next `show()` starts clean. */
  reset(): void {
    this.accept = ''
    this.multiple = false
    this.cropRatio = ''
    this.selected = new Set()
    this.search = ''
  }

  // ---- themed dialogs (replace native confirm/prompt) -------------------

  private confirmDialog(title: string, message?: string, danger = false): Promise<boolean> {
    return new Promise((resolve) => {
      this.dialog = {
        kind: 'confirm',
        title,
        message,
        value: '',
        danger,
        resolve: (r) => resolve(r === true),
      }
    })
  }

  private promptDialog(title: string, value = ''): Promise<string | null> {
    return new Promise((resolve) => {
      this.dialog = {
        kind: 'prompt',
        title,
        value,
        resolve: (r) => resolve(typeof r === 'string' ? r : null),
      }
    })
  }

  private settleDialog(result: boolean | string | null): void {
    this.dialog?.resolve(result)
    this.dialog = null
  }

  // ---- data loading -----------------------------------------------------

  private async load(): Promise<void> {
    this.loading = true
    this.error = ''
    try {
      const [folders, files] = await Promise.all([
        this.api.getFolders(),
        this.api.getFiles(this.currentFolder),
      ])
      this.folders = folders
      this.files = files
      this.loaded = true
    } catch (e) {
      this.error = (e as Error).message
    } finally {
      this.loading = false
    }
  }

  private async reloadFiles(): Promise<void> {
    try {
      this.files = await this.api.getFiles(this.currentFolder)
    } catch (e) {
      this.error = (e as Error).message
    }
  }

  private async openFolder(id: string | null): Promise<void> {
    this.currentFolder = id
    this.selected = new Set()
    this.loading = true
    await this.reloadFiles()
    this.loading = false
  }

  // ---- selection --------------------------------------------------------

  private confirm(files: FileItem[]): void {
    if (!files.length) return
    const detail: SelectDetail = { url: files[0].url, files }
    this.dispatchEvent(
      new CustomEvent<SelectDetail>('selectfile', {
        detail,
        bubbles: true,
        composed: true,
      }),
    )
    this.close()
  }

  private onItemClick(file: FileItem): void {
    if (!this.selectable(file)) return
    // single-pick: clicking confirms immediately
    if (this.pick && !this.multiple) {
      this.confirm([file])
      return
    }
    // multiple-pick OR manage mode: additive toggle (enables bulk actions)
    const next = new Set(this.selected)
    next.has(file.id) ? next.delete(file.id) : next.add(file.id)
    this.selected = next
  }

  private selectable(file: FileItem): boolean {
    return acceptMatches(file, this.accept)
  }

  private insertSelected(): void {
    const chosen = this.visibleFiles.filter((f) => this.selected.has(f.id))
    this.confirm(chosen)
  }

  // ---- file actions -----------------------------------------------------

  private async uploadFiles(list: FileList | File[]): Promise<void> {
    this.uploading = true
    this.error = ''
    try {
      for (const f of Array.from(list)) {
        await this.api.uploadFile(f, this.currentFolder)
      }
      await this.reloadFiles()
    } catch (e) {
      this.error = `${this.dict.uploadError}: ${(e as Error).message}`
    } finally {
      this.uploading = false
    }
  }

  private async deleteFile(file: FileItem): Promise<void> {
    if (!(await this.confirmDialog(this.dict.delete, this.dict.deleteConfirm(file.name), true)))
      return
    await this.api.deleteFile(file)
    await this.reloadFiles()
  }

  private async deleteSelected(): Promise<void> {
    const chosen = this.files.filter((f) => this.selected.has(f.id))
    if (!chosen.length) return
    if (!(await this.confirmDialog(this.dict.delete, this.dict.deleteSelected(chosen.length), true)))
      return
    this.loading = true
    for (const f of chosen) await this.api.deleteFile(f)
    this.selected = new Set()
    await this.reloadFiles()
    this.loading = false
  }

  private async createFolder(): Promise<void> {
    const name = await this.promptDialog(this.dict.newFolder)
    if (!name) return
    const folder = await this.api.createFolder({ name, parent: this.currentFolder })
    this.folders = await this.api.getFolders()
    await this.openFolder(folder.id) // step into the freshly created folder
  }

  private async deleteFolder(folder: Folder): Promise<void> {
    if (!(await this.confirmDialog(this.dict.delete, this.dict.deleteConfirm(folder.name), true)))
      return
    await this.api.deleteFolder(folder)
    if (this.currentFolder === folder.id) await this.openFolder(null)
    this.folders = await this.api.getFolders()
  }

  private async copyUrl(file: FileItem): Promise<void> {
    const url = new URL(file.url, location.href).href
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      /* clipboard may be blocked; ignore */
    }
    this.copiedId = file.id
    setTimeout(() => (this.copiedId = null), 1200)
  }

  // ---- crop + meta panes ------------------------------------------------

  private openCrop(file: FileItem): void {
    this.active = file
    this.pane = 'crop'
  }

  private openMeta(file: FileItem): void {
    this.active = file
    this.metaAlt = file.meta?.alt ?? ''
    this.metaTitle = file.meta?.title ?? ''
    this.metaName = file.name
    this.pane = 'meta'
  }

  private async onCropApply(e: CustomEvent<CropApplyDetail>): Promise<void> {
    if (!this.active) return
    const source = this.active
    this.pane = null
    this.loading = true
    try {
      const derivative = await this.api.cropFile({
        source: source.id,
        crop: e.detail.crop,
        format: e.detail.format,
      })
      await this.reloadFiles()
      // Compose with selection: in single-pick mode, validating the crop also
      // selects the new derivative (see CONTEXT.md / crop flow).
      if (this.pick && !this.multiple) {
        this.confirm([derivative])
      } else {
        this.selected = new Set(this.selected).add(derivative.id)
      }
    } catch (err) {
      this.error = (err as Error).message
    } finally {
      this.loading = false
      this.active = null
    }
  }

  private async saveMeta(file: FileItem): Promise<void> {
    this.loading = true
    try {
      const patch: { name?: string; meta: FileItem['meta'] } = {
        meta: { alt: this.metaAlt, title: this.metaTitle },
      }
      const name = this.metaName.trim()
      if (name && name !== file.name) patch.name = name
      await this.api.updateFile(file, patch)
      await this.reloadFiles()
      this.pane = null
      this.active = null
    } catch (e) {
      this.error = (e as Error).message
    } finally {
      this.loading = false
    }
  }

  // ---- drag & drop ------------------------------------------------------

  private onDragEnter(e: DragEvent): void {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault()
      this.dragOver = true
    }
  }
  private onDragLeave(e: DragEvent): void {
    if (e.target === e.currentTarget) this.dragOver = false
  }
  private onDrop(e: DragEvent): void {
    const dt = e.dataTransfer
    if (!dt) return
    // Use the File System Entries API so dropped FOLDERS import recursively;
    // `dataTransfer.files` alone never descends into directories.
    const entries = Array.from(dt.items ?? [])
      .map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null))
      .filter((en): en is FileSystemEntry => !!en)
    if (entries.some((en) => en.isDirectory)) {
      e.preventDefault()
      this.dragOver = false
      void this.importEntries(entries)
      return
    }
    if (dt.files.length) {
      e.preventDefault()
      this.dragOver = false
      void this.uploadFiles(dt.files)
    }
  }

  /**
   * Import dropped Finder entries (files and/or folders) recursively, recreating
   * the folder structure under the current folder, then step into it.
   */
  private async importEntries(entries: FileSystemEntry[]): Promise<void> {
    this.uploading = true
    this.error = ''
    try {
      const collected: { file: File; dir: string[] }[] = []
      for (const entry of entries) await this.walkEntry(entry, [], collected)

      // create each needed folder once; map relative path → real (deduped) id
      const folderIds = new Map<string, string | null>([['', this.currentFolder]])
      for (const { dir } of collected) await this.ensureFolderPath(dir, folderIds)

      for (const { file, dir } of collected) {
        await this.api.uploadFile(file, folderIds.get(dir.join('/')) ?? this.currentFolder)
      }

      this.folders = await this.api.getFolders()
      // step into the imported folder when exactly one directory was dropped
      const top = entries.length === 1 && entries[0].isDirectory ? entries[0].name : null
      const topId = top ? folderIds.get(top) : undefined
      if (topId !== undefined && topId !== null) await this.openFolder(topId)
      else await this.reloadFiles()
    } catch (err) {
      this.error = `${this.dict.uploadError}: ${(err as Error).message}`
    } finally {
      this.uploading = false
    }
  }

  private walkEntry(
    entry: FileSystemEntry,
    dir: string[],
    out: { file: File; dir: string[] }[],
  ): Promise<void> {
    if (entry.isFile) {
      return new Promise((resolve, reject) =>
        (entry as FileSystemFileEntry).file((f) => {
          out.push({ file: f, dir })
          resolve()
        }, reject),
      )
    }
    if (entry.isDirectory) {
      const sub = [...dir, entry.name]
      return this.readAllEntries(entry as FileSystemDirectoryEntry).then(async (children) => {
        for (const child of children) await this.walkEntry(child, sub, out)
      })
    }
    return Promise.resolve()
  }

  private readAllEntries(dir: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
    const reader = dir.createReader()
    const all: FileSystemEntry[] = []
    return new Promise((resolve, reject) => {
      const next = () =>
        reader.readEntries((batch) => {
          if (!batch.length) resolve(all)
          else {
            all.push(...batch)
            next() // readEntries returns in chunks; keep reading until empty
          }
        }, reject)
      next()
    })
  }

  private async ensureFolderPath(
    dir: string[],
    map: Map<string, string | null>,
  ): Promise<void> {
    for (let i = 0; i < dir.length; i++) {
      const key = dir.slice(0, i + 1).join('/')
      if (map.has(key)) continue
      const parent = map.get(dir.slice(0, i).join('/')) ?? this.currentFolder
      const folder = await this.api.createFolder({ name: dir[i], parent })
      map.set(key, folder.id)
    }
  }

  private onItemDragStart(e: DragEvent, file: FileItem): void {
    // dragging a selected item drags the whole selection, else just this one
    const ids =
      this.selected.has(file.id) && this.selected.size > 1
        ? [...this.selected]
        : [file.id]
    this.dragFileIds = ids
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', ids.join('\n'))
      if (ids.length > 1) this.setCountDragImage(e, ids.length)
    }
  }

  /** Custom drag image: a themed pill with a count badge when moving several files. */
  private setCountDragImage(e: DragEvent, count: number): void {
    // resolve theme colours off a hidden probe (custom props don't read back reliably)
    const probe = this.renderRoot.querySelector('.fm-probe')
    const c = probe ? getComputedStyle(probe) : null
    const surface = c?.backgroundColor || '#fff'
    const fg = c?.color || '#1f2430'
    const primary = c?.borderTopColor || '#2563eb'
    const primaryFg = c?.outlineColor || '#fff'

    const ghost = document.createElement('div')
    ghost.className = 'fm-drag-ghost'
    ghost.style.cssText = `position:absolute;top:-1000px;left:-1000px;display:flex;align-items:center;gap:9px;padding:8px 14px 8px 9px;background:${surface};color:${fg};border:1px solid ${primary};border-radius:999px;box-shadow:0 10px 28px rgba(0,0,0,.35);font:600 13px system-ui,-apple-system,sans-serif;white-space:nowrap;pointer-events:none`

    const badge = document.createElement('span')
    badge.textContent = String(count)
    badge.style.cssText = `min-width:24px;height:24px;padding:0 6px;display:grid;place-items:center;background:${primary};color:${primaryFg};border-radius:999px;font-size:12px;font-weight:700`

    const label = document.createElement('span')
    label.textContent = this.dict.nFiles(count)

    ghost.append(badge, label)
    document.body.appendChild(ghost)
    e.dataTransfer!.setDragImage(ghost, 18, 20)
    setTimeout(() => ghost.remove(), 0)
  }

  private takeDragged(): FileItem[] {
    const ids = this.dragFileIds
    this.dragFileIds = []
    return ids.map((id) => this.files.find((f) => f.id === id)).filter(Boolean) as FileItem[]
  }

  /** Move the dragged File(s) into an existing folder (or root). */
  private async onFolderDrop(folder: Folder | null): Promise<void> {
    const files = this.takeDragged()
    const target = folder?.id ?? null
    const moving = files.filter((f) => f.folder !== target)
    if (!moving.length) return
    this.loading = true
    for (const f of moving) await this.api.moveFile(f, target)
    await this.reloadFiles()
    this.loading = false
  }

  /** Drop on "New folder": ask a name, create it, then move the dragged File(s) in. */
  private async onNewFolderDrop(): Promise<void> {
    const files = this.takeDragged()
    if (!files.length) return
    const name = await this.promptDialog(this.dict.newFolderPrompt)
    if (!name) return
    this.loading = true
    const folder = await this.api.createFolder({ name, parent: this.currentFolder })
    for (const f of files) await this.api.moveFile(f, folder.id)
    this.folders = await this.api.getFolders()
    await this.openFolder(folder.id) // step into the new folder (now holding the dropped files)
  }

  // ---- derived ----------------------------------------------------------

  private get visibleFiles(): FileItem[] {
    const q = this.search.trim().toLowerCase()
    const list = this.files.filter(
      (f) => !q || f.name.toLowerCase().includes(q),
    )
    const dir = this.sortKey
    return [...list].sort((a, b) => {
      if (dir === 'size') return b.size - a.size
      if (dir === 'date') return (b.mtime ?? 0) - (a.mtime ?? 0)
      return a.name.localeCompare(b.name)
    })
  }

  private get breadcrumb(): Folder[] {
    const trail: Folder[] = []
    let id = this.currentFolder
    while (id) {
      const f = this.folders.find((x) => x.id === id)
      if (!f) break
      trail.unshift(f)
      id = f.parent
    }
    return trail
  }

  // ---- rendering --------------------------------------------------------

  override render() {
    if (!this.open) return nothing
    return html`
      <div
        class="overlay"
        @click=${(e: Event) => e.target === e.currentTarget && this.close()}
      >
        <div class="modal" role="dialog" aria-modal="true" aria-label=${this.dict.title}>
          ${this.renderHeader()}
          <div class="body">
            ${this.renderSidebar()}
            <div class="main">
              ${this.renderToolbar()} ${this.renderContent()}
            </div>
          </div>
          ${this.renderFooter()}
          ${this.pane === 'crop' && this.active
            ? html`<fm-crop
                .file=${this.active}
                .dict=${this.dict}
                .imposedRatio=${this.cropRatio || null}
                @crop-apply=${this.onCropApply}
                @crop-cancel=${() => ((this.pane = null), (this.active = null))}
              ></fm-crop>`
            : nothing}
          ${this.pane === 'meta' && this.active ? this.renderMeta(this.active) : nothing}
          ${this.dialog ? this.renderDialog(this.dialog) : nothing}
          <i class="fm-probe" aria-hidden="true"></i>
        </div>
      </div>
    `
  }

  override updated(changed: PropertyValues): void {
    if (changed.has('dialog') && this.dialog?.kind === 'prompt') {
      this.renderRoot.querySelector<HTMLInputElement>('.dialog-box input')?.focus()
    }
  }

  private renderDialog(d: DialogState): TemplateResult {
    const cancel = () => this.settleDialog(d.kind === 'confirm' ? false : null)
    const accept = () => this.settleDialog(d.kind === 'confirm' ? true : d.value)
    return html`
      <div
        class="dialog-backdrop"
        @click=${(e: Event) => e.target === e.currentTarget && cancel()}
        @keydown=${(e: KeyboardEvent) => e.key === 'Escape' && cancel()}
      >
        <div class="dialog-box" role="alertdialog" aria-modal="true" aria-label=${d.title}>
          <h3>${d.title}</h3>
          ${d.message ? html`<p>${d.message}</p>` : nothing}
          ${d.kind === 'prompt'
            ? html`<input
                class="input"
                .value=${d.value}
                @input=${(e: Event) => (d.value = (e.target as HTMLInputElement).value)}
                @keydown=${(e: KeyboardEvent) =>
                  e.key === 'Enter' && (e.preventDefault(), accept())}
              />`
            : nothing}
          <div class="dialog-actions">
            <button class="btn" @click=${cancel}>${this.dict.cancel}</button>
            <button class="btn ${d.danger ? 'solid-danger' : 'primary'}" @click=${accept}>
              ${d.kind === 'confirm'
                ? d.danger
                  ? this.dict.delete
                  : this.dict.confirm
                : this.dict.confirm}
            </button>
          </div>
        </div>
      </div>
    `
  }

  private renderHeader(): TemplateResult {
    return html`
      <header>
        <h2>${this.dict.title}</h2>
        <div class="search">
          <input
            class="input"
            type="search"
            placeholder=${this.dict.search}
            .value=${this.search}
            @input=${(e: Event) => (this.search = (e.target as HTMLInputElement).value)}
          />
        </div>
        <span class="spacer"></span>
        <div class="seg" role="group">
          <button
            aria-pressed=${this.layout === 'grid'}
            title=${this.dict.layoutGrid}
            @click=${() => (this.layout = 'grid')}
          >
            ${icons.grid(16)}
          </button>
          <button
            aria-pressed=${this.layout === 'rows'}
            title=${this.dict.layoutRows}
            @click=${() => (this.layout = 'rows')}
          >
            ${icons.list(16)}
          </button>
        </div>
        <button class="btn ghost icon" title=${this.dict.close} @click=${this.close}>
          ${icons.x()}
        </button>
      </header>
    `
  }

  private renderSidebar(): TemplateResult {
    const roots = this.folders.filter((f) => !f.parent)
    return html`
      <aside class="sidebar">
        <ul class="tree">
          <li>
            <button
              aria-current=${this.currentFolder === null}
              @click=${() => this.openFolder(null)}
              @dragover=${(e: DragEvent) => (e.preventDefault(), this.markDrop(e, true))}
              @dragleave=${(e: DragEvent) => this.markDrop(e, false)}
              @drop=${(e: DragEvent) => (this.markDrop(e, false), this.onFolderDrop(null))}
            >
              ${icons.home(16)} ${this.dict.root}
            </button>
          </li>
          ${roots.map((f) => this.renderFolderNode(f, 0))}
        </ul>
        ${this.readonly
          ? nothing
          : html`<button
              class="btn ghost"
              style="width:100%;justify-content:flex-start;margin-top:.4rem"
              @click=${this.createFolder}
              @dragover=${(e: DragEvent) => (e.preventDefault(), this.markDrop(e, true))}
              @dragleave=${(e: DragEvent) => this.markDrop(e, false)}
              @drop=${(e: DragEvent) => (this.markDrop(e, false), this.onNewFolderDrop())}
            >
              ${icons.folderPlus(16)} ${this.dict.newFolder}
            </button>`}
      </aside>
    `
  }

  private renderFolderNode(folder: Folder, depth: number): TemplateResult {
    const children = this.folders.filter((f) => f.parent === folder.id)
    return html`
      <li>
        <button
          style="padding-left:${0.5 + depth * 0.85}rem"
          aria-current=${this.currentFolder === folder.id}
          @click=${() => this.openFolder(folder.id)}
          @dragover=${(e: DragEvent) => (e.preventDefault(), this.markDrop(e, true))}
          @dragleave=${(e: DragEvent) => this.markDrop(e, false)}
          @drop=${(e: DragEvent) => (this.markDrop(e, false), this.onFolderDrop(folder))}
        >
          ${icons.folder(16)}
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis">${folder.name}</span>
          ${this.readonly
            ? nothing
            : html`<span
                class="del"
                role="button"
                title=${this.dict.delete}
                @click=${(e: Event) => (e.stopPropagation(), this.deleteFolder(folder))}
                style="opacity:.5"
                >${icons.trash(13)}</span
              >`}
        </button>
        ${children.length
          ? html`<ul class="tree">
              ${children.map((c) => this.renderFolderNode(c, depth + 1))}
            </ul>`
          : nothing}
      </li>
    `
  }

  private markDrop(e: DragEvent, on: boolean): void {
    const el = e.currentTarget as HTMLElement
    el.classList.toggle('drop', on)
  }

  private renderToolbar(): TemplateResult {
    const trail = this.breadcrumb
    return html`
      <div class="toolbar">
        <div class="breadcrumb">
          <button @click=${() => this.openFolder(null)}>${this.dict.root}</button>
          ${trail.map(
            (f) => html`${icons.chevronRight(13)}
              <button @click=${() => this.openFolder(f.id)}>${f.name}</button>`,
          )}
        </div>
        <span class="spacer"></span>
        <select
          class="input"
          style="width:auto"
          @change=${(e: Event) =>
            (this.sortKey = (e.target as HTMLSelectElement).value as SortKey)}
        >
          <option value="name">${this.dict.sortName}</option>
          <option value="date">${this.dict.sortDate}</option>
          <option value="size">${this.dict.sortSize}</option>
        </select>
        ${this.selected.size && !this.readonly
          ? html`<button class="btn danger" @click=${this.deleteSelected}>
              ${icons.trash(15)} ${this.dict.selected(this.selected.size)}
            </button>`
          : nothing}
        ${this.readonly
          ? nothing
          : html`
              <label class="btn ${this.uploading ? '' : 'primary'}">
                ${this.uploading ? html`<span class="spinner"></span>` : icons.upload(15)}
                ${this.dict.upload}
                <input
                  type="file"
                  multiple
                  hidden
                  @change=${(e: Event) => {
                    const input = e.target as HTMLInputElement
                    if (input.files?.length) void this.uploadFiles(input.files)
                    input.value = ''
                  }}
                />
              </label>
            `}
      </div>
    `
  }

  private renderContent(): TemplateResult {
    const files = this.visibleFiles
    return html`
      <div
        class="content"
        @dragenter=${this.onDragEnter}
        @dragover=${(e: DragEvent) => e.dataTransfer?.types.includes('Files') && e.preventDefault()}
        @dragleave=${this.onDragLeave}
        @drop=${this.onDrop}
      >
        ${this.loading ? html`<div class="loading"><span class="spinner"></span></div>` : nothing}
        ${this.dragOver ? html`<div class="dropzone">${icons.upload(28)} ${this.dict.dropHere}</div>` : nothing}
        ${this.error ? html`<p style="color:var(--fm-danger)">${this.error}</p>` : nothing}
        ${files.length === 0 && !this.loading
          ? html`<div class="empty">
              ${icons.image(40)}
              <p>${this.dict.empty}</p>
              <small>${this.dict.emptyHint}</small>
            </div>`
          : html`<div class=${this.layout === 'grid' ? 'grid' : 'rows'}>
              ${files.map((f) => this.renderItem(f))}
            </div>`}
      </div>
    `
  }

  private renderThumb(file: FileItem): TemplateResult {
    // images → the file itself; non-images with a real (non-placeholder) thumbnail
    // → that thumbnail (e.g. a video poster); otherwise a typed extension glyph.
    if (isImage(file)) {
      return html`<img class="thumb" src=${file.url} alt="" loading="lazy" />`
    }
    if (file.thumbnail && !file.thumbnail.startsWith('data:')) {
      return html`<img class="thumb" src=${file.thumbnail} alt="" loading="lazy" />`
    }
    return html`<div class="thumb file-glyph">${fileGlyph(file.name)}</div>`
  }

  private renderItem(file: FileItem): TemplateResult {
    const selected = this.selected.has(file.id)
    const disabled = !this.selectable(file)
    return html`
      <div
        class="item"
        role="option"
        aria-selected=${selected}
        data-disabled=${disabled}
        draggable=${!this.readonly}
        @dragstart=${(e: DragEvent) => this.onItemDragStart(e, file)}
        @click=${() => this.onItemClick(file)}
        @dblclick=${() => this.pick && !this.multiple && this.selectable(file) && this.confirm([file])}
      >
        ${this.multiple || !this.pick
          ? html`<span class="check">${selected ? icons.check(14) : nothing}</span>`
          : nothing}
        ${this.renderThumb(file)}
        ${this.layout === 'rows'
          ? html`<span class="label">${file.name}</span>
              <span class="size">${formatBytes(file.size)}</span>`
          : html`<div class="label">${file.name}</div>`}
        ${this.renderItemActions(file)}
      </div>
    `
  }

  private renderItemActions(file: FileItem): TemplateResult {
    return html`
      <div class="actions" @click=${(e: Event) => e.stopPropagation()}>
        ${isImage(file) && !this.readonly
          ? html`<button title=${this.dict.crop} @click=${() => this.openCrop(file)}>
              ${icons.crop(15)}
            </button>`
          : nothing}
        ${this.readonly
          ? nothing
          : html`<button title=${this.dict.edit} @click=${() => this.openMeta(file)}>
              ${icons.edit(15)}
            </button>`}
        <button
          title=${this.copiedId === file.id ? this.dict.copied : this.dict.copyUrl}
          @click=${() => this.copyUrl(file)}
        >
          ${this.copiedId === file.id ? icons.check(15) : icons.link(15)}
        </button>
        ${this.readonly
          ? nothing
          : html`<button title=${this.dict.delete} @click=${() => this.deleteFile(file)}>
              ${icons.trash(15)}
            </button>`}
      </div>
    `
  }

  private renderFooter(): TemplateResult | typeof nothing {
    if (!this.pick || !this.multiple) return nothing
    const n = this.selected.size
    return html`
      <footer>
        <span style="color:var(--fm-muted);font-size:.85rem">${this.dict.selected(n)}</span>
        <span class="spacer"></span>
        <button class="btn" @click=${this.close}>${this.dict.cancel}</button>
        <button class="btn primary" ?disabled=${n === 0} @click=${this.insertSelected}>
          ${this.dict.insertN(n)}
        </button>
      </footer>
    `
  }

  private renderMeta(file: FileItem): TemplateResult {
    return html`
      <div class="pane">
        <header>
          <h2>${this.dict.metaTitle}</h2>
          <span class="spacer"></span>
          <button
            class="btn ghost icon"
            @click=${() => ((this.pane = null), (this.active = null))}
          >
            ${icons.x()}
          </button>
        </header>
        <div class="pane-body">
          <div class="crop-stage" style="background:var(--fm-surface-3)">
            <img src=${file.url} alt="" style="max-height:100%;object-fit:contain" />
          </div>
          <div class="meta-side">
            <div class="field">
              <label>${this.dict.rename}</label>
              <input
                class="input"
                .value=${this.metaName}
                @input=${(e: Event) => (this.metaName = (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="field">
              <label>${this.dict.alt}</label>
              <textarea
                class="input"
                .value=${this.metaAlt}
                @input=${(e: Event) => (this.metaAlt = (e.target as HTMLTextAreaElement).value)}
              ></textarea>
              <p class="hint">${this.dict.altHint}</p>
            </div>
            <div class="field">
              <label>${this.dict.caption}</label>
              <input
                class="input"
                .value=${this.metaTitle}
                @input=${(e: Event) => (this.metaTitle = (e.target as HTMLInputElement).value)}
              />
            </div>
            <p class="hint" style="word-break:break-all">${file.url}</p>
            <span class="spacer"></span>
            <button class="btn primary" @click=${() => this.saveMeta(file)}>
              ${this.dict.save}
            </button>
          </div>
        </div>
      </div>
    `
  }

  /** Register the custom element + global options. */
  static register(name = 'file-manager', options: RegisterOptions = {}): void {
    FileManager.options = { ...FileManager.options, ...options }
    if (!customElements.get(name)) customElements.define(name, FileManager)
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'file-manager': FileManager
  }
  interface HTMLElementEventMap {
    selectfile: CustomEvent<SelectDetail>
  }
}
