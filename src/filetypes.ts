import { svg, type SVGTemplateResult } from 'lit'
import { extOf } from './utils'

// Extension → accent colour. Anything unknown falls back to a neutral grey, and
// the glyph always shows the extension text, so even exotic types read clearly.
const COLOR: Record<string, string> = {}
const reg = (color: string, exts: string[]) => exts.forEach((e) => (COLOR[e] = color))
reg('#e5484d', ['pdf'])
reg('#ff7a18', ['ai', 'eps', 'ps']) // Illustrator / PostScript
reg('#2f6bff', ['psd', 'doc', 'docx']) // Photoshop / Word
reg('#e93d82', ['fig', 'sketch', 'xd']) // design tools
reg('#7c5cff', ['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v']) // video
reg('#12a594', ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']) // audio
reg('#f5a524', ['zip', 'rar', '7z', 'tar', 'gz']) // archive
reg('#16a34a', ['xls', 'xlsx', 'csv']) // spreadsheet
reg('#ea580c', ['ppt', 'pptx']) // slides
reg('#64748b', ['js', 'ts', 'json', 'html', 'css', 'xml', 'php', 'py', 'md', 'txt']) // text/code

export function fileTypeColor(name: string): string {
  return COLOR[extOf(name)] ?? '#94a3b8'
}

/**
 * A document glyph for a non-image File: a themed page (adapts to the active
 * theme via `--fm-*`) with a category-coloured label band carrying the extension.
 */
export function fileGlyph(name: string): SVGTemplateResult {
  const ext = extOf(name)
  const color = fileTypeColor(name)
  const label = (ext || 'file').slice(0, 4).toUpperCase()
  return svg`
    <svg viewBox="0 0 48 52" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 5a3 3 0 0 1 3-3h16l11 11v32a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V5Z"
        fill="var(--fm-surface)"
        stroke="var(--fm-border)"
        stroke-width="1.5"
      />
      <path d="M28 2l11 11h-8a3 3 0 0 1-3-3V2Z" fill="var(--fm-border)" />
      <rect x="9" y="28" width="30" height="14" rx="2.5" fill="${color}" />
      <text
        x="24"
        y="38"
        text-anchor="middle"
        fill="#fff"
        font-family="system-ui, sans-serif"
        font-size="8"
        font-weight="700"
        letter-spacing=".3"
      >
        ${label}
      </text>
    </svg>`
}
