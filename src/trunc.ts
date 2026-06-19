import { LitElement, html, css, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

/**
 * `<fm-trunc text="…">` — a single-line label with a **middle** ellipsis, the way
 * macOS Finder truncates long names: the start and the end stay visible and
 * characters are dropped from the centre until the text fits its box. Re-measures
 * on resize, so it tracks the sidebar width (and the space freed/taken when the
 * active folder's delete button appears). Falls back to a plain end-ellipsis via
 * CSS before the first measurement.
 */
@customElement('fm-trunc')
export class FmTrunc extends LitElement {
  static override styles = css`
    :host {
      display: block;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  `

  @property() text = ''
  @state() private shown = ''

  private ro?: ResizeObserver

  override connectedCallback(): void {
    super.connectedCallback()
    // observe(this) fires once immediately, giving the first real width
    this.ro = new ResizeObserver(() => this.fit())
    this.ro.observe(this)
  }

  override disconnectedCallback(): void {
    this.ro?.disconnect()
    this.ro = undefined
    super.disconnectedCallback()
  }

  // A new name is computed *before* render (willUpdate), not after, so Lit never
  // schedules a second update. This is sound because the box width is fixed by the
  // flex layout and never depends on the text we are about to render.
  override willUpdate(changed: PropertyValues): void {
    if (changed.has('text')) this.shown = this.truncate()
  }

  /** ResizeObserver callback — re-fit when the available width changes. */
  private fit(): void {
    const next = this.truncate()
    if (next !== this.shown) this.shown = next
  }

  /** The visible string for the element's current width (full text until laid out). */
  private truncate(): string {
    const cs = getComputedStyle(this)
    // Reference width: when a max-width caps us (e.g. breadcrumb segments) measure
    // against that fixed cap — otherwise an inline-block would shrink to its own
    // truncated text and lock the ellipsis in. When uncapped (sidebar) the element
    // is sized by flex, so its clientWidth is the real available space.
    const cap = cs.maxWidth === 'none' ? 0 : parseFloat(cs.maxWidth)
    const width = cap || this.clientWidth
    if (!width || !this.text) {
      this.title = ''
      return this.text
    }
    const c = measureCtx()
    // build the font from longhands — getComputedStyle().font is unreliable
    c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const out = middleTruncate(c, this.text, width)
    // native tooltip with the full name, but only when something was actually cut
    this.title = out === this.text ? '' : this.text
    return out
  }

  override render() {
    return html`${this.shown || this.text}`
  }
}

let cached: CanvasRenderingContext2D | null = null
/** A lazily-created, shared 2D context used only to measure text widths. */
function measureCtx(): CanvasRenderingContext2D {
  if (!cached) cached = document.createElement('canvas').getContext('2d')!
  return cached
}

/**
 * Drop characters from the centre of `text` until it fits `maxWidth`, keeping a
 * single `…` between the surviving head and tail (the head keeps the odd char, so
 * slightly more of the start shows — matching Finder). Binary-searches the number
 * of kept characters, so it costs ~log₂(n) width measurements.
 */
function middleTruncate(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  // split by code points (not UTF-16 units) so emoji/surrogate pairs never tear
  const chars = Array.from(text)
  const ell = '…'
  let lo = 0
  let hi = chars.length - 1
  let best = ell
  while (lo <= hi) {
    const keep = (lo + hi) >> 1
    const head = Math.ceil(keep / 2)
    const tail = keep - head
    const candidate =
      chars.slice(0, head).join('') +
      ell +
      (tail ? chars.slice(chars.length - tail).join('') : '')
    if (ctx.measureText(candidate).width <= maxWidth) {
      best = candidate
      lo = keep + 1
    } else {
      hi = keep - 1
    }
  }
  return best
}

declare global {
  interface HTMLElementTagNameMap {
    'fm-trunc': FmTrunc
  }
}
