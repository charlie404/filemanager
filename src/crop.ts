import { LitElement, html, unsafeCSS, type PropertyValues } from 'lit'
import { customElement, property, query, state } from 'lit/decorators.js'
import Cropper from 'cropperjs'
import cropperCss from 'cropperjs/dist/cropper.css?inline'
import { elementStyles } from './styles'
import { icons } from './icons'
import { parseRatio } from './utils'
import type { CropRect, FileItem } from './types'
import type { Dict } from './i18n'

interface Preset {
  label: string
  value: number | null
}

/** Emitted when the user applies a crop. */
export interface CropApplyDetail {
  crop: CropRect
  format?: 'jpeg' | 'png' | 'webp'
}

@customElement('fm-crop')
export class FmCrop extends LitElement {
  static override styles = [unsafeCSS(cropperCss), elementStyles]

  @property({ attribute: false }) file!: FileItem
  @property({ attribute: false }) dict!: Dict
  /** Imposed aspect ratio; when set, the user cannot switch presets. */
  @property({ attribute: false }) imposedRatio: string | number | null = null

  @state() private activeRatio: number | null = null
  @state() private format: '' | 'jpeg' | 'png' | 'webp' = ''

  @query('img') private img!: HTMLImageElement
  private cropper?: Cropper

  override connectedCallback(): void {
    super.connectedCallback()
    this.activeRatio = parseRatio(this.imposedRatio)
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.cropper?.destroy()
    this.cropper = undefined
  }

  private get presets(): Preset[] {
    return [
      { label: this.dict.ratioFree, value: null },
      { label: '1:1', value: 1 },
      { label: '4:3', value: 4 / 3 },
      { label: '3:2', value: 3 / 2 },
      { label: '16:9', value: 16 / 9 },
    ]
  }

  private get locked(): boolean {
    return parseRatio(this.imposedRatio) !== null
  }

  private initCropper = () => {
    this.cropper?.destroy()
    this.cropper = new Cropper(this.img, {
      viewMode: 1,
      autoCropArea: 1,
      background: false,
      aspectRatio: this.activeRatio ?? NaN,
      responsive: true,
    })
  }

  private setRatio(value: number | null) {
    if (this.locked) return
    this.activeRatio = value
    this.cropper?.setAspectRatio(value ?? NaN)
  }

  private apply() {
    if (!this.cropper) return
    const data = this.cropper.getData(true) // rounded, natural source pixels
    const crop: CropRect = {
      x: Math.max(0, data.x),
      y: Math.max(0, data.y),
      width: data.width,
      height: data.height,
    }
    this.dispatchEvent(
      new CustomEvent<CropApplyDetail>('crop-apply', {
        detail: { crop, format: this.format || undefined },
      }),
    )
  }

  private cancel() {
    this.dispatchEvent(new CustomEvent('crop-cancel'))
  }

  override updated(changed: PropertyValues): void {
    if (changed.has('file') && this.img?.complete && this.img.naturalWidth) {
      this.initCropper()
    }
  }

  override render() {
    return html`
      <div class="pane">
        <header>
          <h2>${this.dict.cropTitle}</h2>
          <span class="spacer"></span>
          <button class="btn ghost icon" @click=${this.cancel} title=${this.dict.close}>
            ${icons.x()}
          </button>
        </header>
        <div class="pane-body">
          <div class="crop-stage">
            <img
              src=${this.file.url}
              alt=""
              crossorigin="anonymous"
              @load=${this.initCropper}
            />
          </div>
          <div class="crop-side">
            <div class="field">
              <label>${this.dict.cropTitle}</label>
              <div class="ratios">
                ${this.presets.map(
                  (p) => html`
                    <button
                      class="btn"
                      ?disabled=${this.locked && p.value !== this.activeRatio}
                      aria-pressed=${this.activeRatio === p.value}
                      style=${this.activeRatio === p.value
                        ? 'background:var(--fm-primary);color:var(--fm-primary-fg);border-color:var(--fm-primary)'
                        : ''}
                      @click=${() => this.setRatio(p.value)}
                    >
                      ${p.label}
                    </button>
                  `,
                )}
              </div>
              ${this.locked
                ? html`<p class="hint">${this.dict.cropTitle} · ${this.imposedRatio}</p>`
                : null}
            </div>
            <div class="field">
              <label>Format</label>
              <select
                class="input"
                @change=${(e: Event) =>
                  (this.format = (e.target as HTMLSelectElement).value as never)}
              >
                <option value="">Source</option>
                <option value="webp">WebP</option>
                <option value="jpeg">JPEG</option>
                <option value="png">PNG</option>
              </select>
            </div>
            <span class="spacer"></span>
            <button class="btn primary" @click=${this.apply}>
              ${icons.crop()} ${this.dict.apply}
            </button>
            <button class="btn" @click=${this.cancel}>${this.dict.cancel}</button>
          </div>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fm-crop': FmCrop
  }
}
