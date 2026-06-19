// @charlie404/filemanager — public entry point.
//
//   import { FileManager, bindFileManagers, openFileManager } from '@charlie404/filemanager'
//   FileManager.register('file-manager', { endpoint: '/admin/file-manager' })
//   bindFileManagers()                       // wire data-filemanager* fields
//   // …or one-liner: autoInit('file-manager', { endpoint: '…' })
//
// No CSS import is required — element styles live in Shadow DOM and the binding
// chips inject their own stylesheet.

export { FileManager } from './FileManager'
export type { RegisterOptions } from './FileManager'
export { FmCrop } from './crop'
export { FmTrunc } from './trunc'
export { createRestApi } from './api'
export type { RestApiOptions } from './api'
export {
  openFileManager,
  openFileManagerFile,
  openFileManagerFiles,
  bindFileManagers,
  setInstanceTag,
  autoInit,
} from './binding'
export { resolveDict } from './i18n'
export type { Dict } from './i18n'
export type {
  Folder,
  FileItem,
  FileMeta,
  FileManagerApi,
  CropRect,
  CropParams,
  OpenOptions,
  SelectDetail,
  Layout,
  SortKey,
  ThemeMode,
  Lang,
} from './types'
