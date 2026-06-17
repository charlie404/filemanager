import type { FileItem } from './types'

const IMAGE_EXT = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'avif',
  'svg',
  'bmp',
  'ico',
])

const CATEGORY_EXT: Record<string, Set<string>> = {
  image: IMAGE_EXT,
  video: new Set(['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v']),
  audio: new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']),
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i + 1).toLowerCase()
}

export function isImage(file: Pick<FileItem, 'name'>): boolean {
  return IMAGE_EXT.has(extOf(file.name))
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

/** Parse `"16:9"`, `"free"`, or a number into an aspect ratio, or `null` (free). */
export function parseRatio(ratio?: string | number | null): number | null {
  if (ratio == null || ratio === 'free' || ratio === '') return null
  if (typeof ratio === 'number') return ratio > 0 ? ratio : null
  if (ratio.includes(':')) {
    const [w, h] = ratio.split(':').map(Number)
    return w > 0 && h > 0 ? w / h : null
  }
  const n = Number(ratio)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Does a File satisfy an `accept` filter (`"image/*"`, `".jpg,.png"`, `"image/png"`)?
 * Matching is by extension/category since the server need not expose a mime type.
 */
export function acceptMatches(file: Pick<FileItem, 'name'>, accept?: string): boolean {
  if (!accept || accept.trim() === '') return true
  const ext = extOf(file.name)
  return accept
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .some((token) => {
      if (!token) return false
      if (token.startsWith('.')) return token.slice(1) === ext
      if (token.endsWith('/*')) {
        const cat = token.slice(0, -2)
        return CATEGORY_EXT[cat]?.has(ext) ?? false
      }
      if (token.includes('/')) {
        // explicit mime: match by sub-type extension (image/png -> png) best-effort
        const sub = token.split('/')[1]
        return sub === ext || (sub === 'jpeg' && ext === 'jpg')
      }
      return token === ext
    })
}

/** A neutral placeholder thumbnail for non-image files when the server omits one. */
export function placeholderThumb(): string {
  return (
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="1.5"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/></svg>',
    )
  )
}
