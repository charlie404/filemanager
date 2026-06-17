// @charlie404/filemanager — Laravel front-end bootstrap.
//
// Build this with Vite (see vite.config.js / README) and load it on any page
// that uses a <file-manager> element or a [data-filemanager] field.
//
//   npm i @charlie404/filemanager
//
// The element's default backend is a REST client against the documented
// contract; here we point it at the Laravel route group and forward Laravel's
// CSRF token so the mutating (POST/PUT/DELETE) routes pass the `web` group's
// VerifyCsrfToken middleware. The token comes from a <meta name="csrf-token">
// tag rendered in the layout (see _filemanager.blade.php / README).

import { FileManager, bindFileManagers, openFileManager } from '@charlie404/filemanager'

const endpoint = '/admin/file-manager'

const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''

// Register the custom element <file-manager> with the Laravel endpoint. The
// CSRF token is sent on every request; cookies (session) are sent because the
// REST client defaults to credentials: 'same-origin'.
FileManager.register('file-manager', {
  endpoint,
  headers: csrf ? { 'X-CSRF-TOKEN': csrf } : {},
})

// Wire every declarative field: [data-filemanager] single inputs and
// [data-filemanager][data-filemanager-multiple] gallery inputs. Idempotent —
// call again after injecting DOM (e.g. Livewire/Turbo) updates.
bindFileManagers()

// ---------------------------------------------------------------------------
// Visual-editor adapter (optional)
// ---------------------------------------------------------------------------
// If you also use @charlie404/visual-editor, pass `openFileManager` as the
// `onBrowse` callback. It opens the picker and resolves the chosen file's URL,
// matching the visual editor's `onBrowse: (url?) => Promise<string>` contract:
//
//   import { VisualEditor } from '@charlie404/visual-editor'
//   import { openFileManager } from '@charlie404/filemanager'
//
//   new VisualEditor({
//     // …your editor config…
//     onBrowse: openFileManager, // (opts?) => Promise<string>
//   })
