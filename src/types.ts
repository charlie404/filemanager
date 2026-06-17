// ---------------------------------------------------------------------------
// Domain model — the shared language (see CONTEXT.md) and the backend contract.
// `File` (the media item) is named `FileItem` in code to avoid clashing with the
// DOM `File` used for uploads.
// ---------------------------------------------------------------------------

/** A directory under the storage root. */
export interface Folder {
  /** Path under the storage root, e.g. `"products/2024"`. Empty/`null` = root. */
  id: string
  name: string
  parent: string | null
}

/** Editable descriptive fields carried by a File. */
export interface FileMeta {
  alt?: string
  title?: string
}

/** One stored media item. */
export interface FileItem {
  /** Path under the storage root, e.g. `"products/photo.jpg"`. */
  id: string
  name: string
  /** Public URL the host ultimately consumes. */
  url: string
  folder: string | null
  /** Image url for previews, or a data: SVG placeholder for non-images. */
  thumbnail: string
  /** Bytes. */
  size: number
  /** Last-modified time (epoch seconds); optional, used for date sorting. */
  mtime?: number
  meta: FileMeta
}

/** A crop rectangle expressed in the **natural pixels** of the source image. */
export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

/** Payload sent to the crop endpoint to produce a Derivative. */
export interface CropParams {
  /** Source File id. */
  source: string
  crop: CropRect
  /** Output format; omit to keep the source format. */
  format?: 'jpeg' | 'png' | 'webp'
  /** 0..1, encoder quality for lossy formats. */
  quality?: number
  /** Downscale the output so its width never exceeds this (in px). */
  maxWidth?: number
}

/**
 * The pluggable backend. The default implementation is a REST client against the
 * documented contract; hosts can override any method via `register()` options.
 */
export interface FileManagerApi {
  getFolders(): Promise<Folder[]>
  createFolder(params: { name: string; parent: string | null }): Promise<Folder>
  renameFolder(folder: Folder, name: string): Promise<Folder>
  deleteFolder(folder: Folder): Promise<void>
  getFiles(folder: string | null): Promise<FileItem[]>
  uploadFile(file: File, folder: string | null): Promise<FileItem>
  updateFile(
    file: FileItem,
    patch: { name?: string; meta?: FileMeta },
  ): Promise<FileItem>
  moveFile(file: FileItem, to: string | null): Promise<FileItem>
  deleteFile(file: FileItem): Promise<void>
  cropFile(params: CropParams): Promise<FileItem>
}

export type Layout = 'grid' | 'rows'
export type SortKey = 'name' | 'date' | 'size'
export type ThemeMode = 'auto' | 'light' | 'dark'

/** Per-open configuration, applied to the shared instance then reset on close. */
export interface OpenOptions {
  /** Mime/extension filter, e.g. `"image/*"` or `".jpg,.png"`. */
  accept?: string
  /** Allow choosing several Files. */
  multiple?: boolean
  /** `"16:9"`, `"1:1"`, a number, or `"free"`. Constrains the crop editor. */
  cropRatio?: string | number
}

/**
 * `selectfile` event detail — a uniform shape. `url` (the first File's url) is
 * always present for backward compatibility; `files` carries the full selection.
 */
export interface SelectDetail {
  url: string
  files: FileItem[]
}

export type Lang = 'en' | 'fr'
