import type {
  CropParams,
  FileItem,
  FileManagerApi,
  FileMeta,
  Folder,
} from './types'

export interface RestApiOptions {
  /** Base URL of the REST contract, e.g. `/admin/file-manager`. */
  endpoint: string
  /** Extra headers (auth tokens, CSRF, …) sent with every request. */
  headers?: Record<string, string>
  /** Send credentials (cookies) — defaults to `'same-origin'`. */
  credentials?: RequestCredentials
}

/** Encode a path-like id without escaping its `/` separators. */
function encodePath(id: string): string {
  return id
    .split('/')
    .map(encodeURIComponent)
    .join('/')
}

/**
 * Default backend: a REST client against the documented contract. Every method
 * is overridable through `register()` options, so a host that does not use a
 * REST API can swap individual calls.
 */
export function createRestApi(opts: RestApiOptions): FileManagerApi {
  const base = opts.endpoint.replace(/\/$/, '')
  const credentials = opts.credentials ?? 'same-origin'

  async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const isForm = init.body instanceof FormData
    const res = await fetch(base + path, {
      credentials,
      ...init,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        Accept: 'application/json',
        ...opts.headers,
        ...init.headers,
      },
    })
    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`
      try {
        const data = await res.json()
        if (data?.error || data?.message) message = data.error ?? data.message
      } catch {
        /* ignore non-JSON error bodies */
      }
      throw new Error(message)
    }
    if (res.status === 204) return undefined as T
    const text = await res.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  return {
    getFolders: () => req<Folder[]>('/folders'),

    createFolder: (params) =>
      req<Folder>('/folders', {
        method: 'POST',
        body: JSON.stringify(params),
      }),

    renameFolder: (folder, name) =>
      req<Folder>(`/folders/${encodePath(folder.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      }),

    deleteFolder: (folder) =>
      req<void>(`/folders/${encodePath(folder.id)}`, { method: 'DELETE' }),

    getFiles: (folder) =>
      req<FileItem[]>(`/files?folder=${encodeURIComponent(folder ?? '')}`),

    uploadFile: (file, folder) => {
      const body = new FormData()
      body.append('file', file)
      body.append('folder', folder ?? '')
      return req<FileItem>('/files', { method: 'POST', body })
    },

    updateFile: (file, patch: { name?: string; meta?: FileMeta }) =>
      req<FileItem>(`/files/${encodePath(file.id)}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      }),

    moveFile: (file, to) =>
      req<FileItem>('/files/move', {
        method: 'POST',
        body: JSON.stringify({ from: file.id, to: to ?? '' }),
      }),

    deleteFile: (file) =>
      req<void>(`/files/${encodePath(file.id)}`, { method: 'DELETE' }),

    cropFile: (params: CropParams) =>
      req<FileItem>('/files/crop', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
  }
}
