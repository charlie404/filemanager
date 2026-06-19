# @charlie404/filemanager

A framework-agnostic `<file-manager>` custom element: a modal media browser an admin mounts
once on a page and toggles open to browse, upload, organise and **crop** the **File**s stored
on a server, then hand the chosen File's `url` back to the host. It is a drop-in **superset of
[Grafikart's `filemanager-element`](https://github.com/Grafikart/FilemanagerElement)**, adding
**server-side non-destructive image cropping**, **automatic theme adaptation** (a daisyUI token
bridge with a `prefers-color-scheme` fallback), multiple selection, **Metadata** editing
(`alt` / `title`), move-by-drag, and an `accept` filter. It ships as a single self-contained
ESM bundle — **no CSS import required**, no framework, no Symfony bundle. The REST backend is
implemented per host against a small documented contract (reference servers under
`examples/{symfony,laravel,vanilla}`). MIT licensed.

## Features

- **One custom element**, framework-agnostic — works in Symfony, Laravel, plain HTML, or any
  bundler. Built on [Lit](https://lit.dev) + [Cropper.js](https://fengyuanchen.github.io/cropperjs/).
- **Drop-in Grafikart superset** — the legacy `data-open-file-manager` trigger and the
  `selectfile` event (`detail.url`) keep working unchanged.
- **Server-side, non-destructive crop** — cropping produces a **Derivative**: a brand-new File
  next to the source, computed server-side via GD/Imagick. The source is never touched and the
  Selection returns the Derivative's `url` (see [ADR 0001](docs/adr/0001-server-side-non-destructive-crop.md)).
- **Automatic theming** — the element renders in Shadow DOM and maps its internal `--fm-*`
  tokens onto daisyUI's `--color-base-*` variables, so inside a daisyUI back-office it adopts
  the active `data-theme` (light, dark, dim, material, contrast, …) with zero configuration.
  Outside daisyUI it falls back to a light default overridden by `prefers-color-scheme: dark`
  (see [ADR 0002](docs/adr/0002-theming-via-daisyui-token-bridge.md)).
- **Single or multiple selection** — multiple mode submits repeated `name[]` inputs and renders
  removable thumbnail chips.
- **Metadata** — edit `alt` and `title` per File; stored however the backend chooses (the
  bundled examples use a per-folder `.meta.json` sidecar, so no database is required).
- **Organise** — nested folders; **drag one or several files onto a folder** to move them, or
  **onto “New folder”** to create one on the fly and drop them in; rename, delete (incl. bulk
  selection), search, sort, grid/rows layouts.
- **Collapsible folder tree** — the sidebar tree folds per folder (chevrons) and **opens fully
  collapsed**, so deep hierarchies stay tidy; opening a folder expands it, and the **New folder**
  action stays pinned at the top of the sidebar while the tree scrolls. The new-folder prompt
  shows which folder it will be created in. Long folder names **truncate with a middle ellipsis**
  (macOS Finder style; full name on hover / as the accessible label) instead of wrapping, and the
  **delete** action shows only on the active folder. The breadcrumb likewise stays on a single line,
  scrolling to the current folder rather than wrapping.
- **Opens in context** — when a field already holds a File, the picker opens **straight into that
  File's folder**, expanding the tree down to it. Declarative fields do this automatically; for
  programmatic opens, pass the current value as the new `path` option (see
  [Opening in the right folder](#opening-in-the-right-folder-path)).
- **Drag-and-drop upload** — drop files to upload, or **drop a whole folder from Finder/Explorer**
  to import its contents recursively, recreating the subfolder structure and stepping into it.
- **Themed dialogs** — confirm/prompt render inside the element (no native `alert`/`confirm`),
  so deletes and folder names match the active theme and language.
- **Runtime i18n** — English + French bundled, inferred from `<html lang>` and switchable live
  via the `lang` attribute/property.
- **Typed file icons** — non-image Files (pdf, ai, ps, mp4, zip, doc, …) show a colour-coded
  extension glyph rendered client-side, so it works for any extension with no server-side icons.
- **`accept` filter** — restrict the picker to e.g. `image/*` or `.jpg,.png`.
- **No CSS to import** — element styles live in Shadow DOM; the declarative chips/buttons inject
  their own stylesheet automatically.

## Install

```bash
npm i @charlie404/filemanager
```

### Quick start

Register the element, point it at your REST endpoint, and wire any declarative fields:

```js
import { FileManager, bindFileManagers } from '@charlie404/filemanager'

FileManager.register('file-manager', { endpoint: '/admin/file-manager' })
bindFileManagers() // enhance every data-filemanager* field on the page
```

That's it — **no stylesheet import is needed**. (One-liner equivalent:
`autoInit('file-manager', { endpoint: '/admin/file-manager' })`, which registers, sets the
instance tag, and binds once the DOM is ready.)

## Usage

### Declarative form fields

Add `data-filemanager` to any text input to turn it into a media field with a browse button.
The chosen File's `url` is written into the input and `input`/`change` events are dispatched.
**When the input already holds a url, the picker opens directly in that File's folder** — this is
automatic, no extra attribute or code.

```html
<!-- Single value: writes the chosen url into this input -->
<input
  type="text"
  name="cover"
  data-filemanager
  data-filemanager-accept="image/*"
  data-filemanager-crop-ratio="16:9"
  data-filemanager-alt-target="#cover-alt"
/>
<input type="hidden" id="cover-alt" name="cover_alt" />
```

| Attribute                     | Purpose                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `data-filemanager`            | Marks the field; renders a browse button after it.                                 |
| `data-filemanager-accept`     | Mime/extension filter passed to the picker (e.g. `image/*`, `.jpg,.png`).          |
| `data-filemanager-crop-ratio` | Constrains the crop editor (`"16:9"`, `"1:1"`, a number, or `"free"`).             |
| `data-filemanager-alt-target` | CSS selector of another input; the chosen File's `alt` Metadata is copied into it. |
| `data-filemanager-multiple`   | Switches the field to multiple mode (see below). Value-less.                       |

**Multiple selection.** Add `data-filemanager-multiple`. The original input is converted to
`type="hidden"` and stops submitting; the picker opens in multiple mode and each chosen File
becomes a **removable thumbnail chip** backed by a hidden `<input name="cover[]">`. The field
therefore submits a repeated **`name[]`** array (the `[]` suffix is added automatically if your
`name` lacks it). Pre-existing values (newline-separated in the input's initial value) seed
chips on load.

```html
<input
  type="text"
  name="gallery"
  value=""
  data-filemanager
  data-filemanager-multiple
  data-filemanager-accept="image/*"
/>
<!-- submits gallery[]=…&gallery[]=… -->
```

### Legacy / Grafikart compatibility

The original Grafikart trigger keeps working:

```html
<!-- Browse and write the chosen url into #cover -->
<button type="button" data-open-file-manager="#cover">Browse…</button>

<!-- No selector → open in "manage" mode: browse/organise without picking -->
<button type="button" data-open-file-manager>Manage media</button>
```

`accept` / `crop-ratio` are read from the _target_ input's `data-filemanager-*` attributes, so
existing markup needs no changes. The trigger also opens in the **target input's current value**
folder, exactly like the declarative fields above.

### Programmatic

```js
import {
  openFileManager, // → Promise<string>      (resolves the chosen File's url)
  openFileManagerFile, // → Promise<FileItem>     (resolves the full File, single)
  openFileManagerFiles, // → Promise<FileItem[]>   (resolves all chosen Files, multiple)
} from '@charlie404/filemanager'

// Drop-in for a visual-editor `onBrowse: (url?) => Promise<string>` field:
const url = await openFileManager({ accept: 'image/*', cropRatio: '1:1' })

// Multiple selection:
const files = await openFileManagerFiles({ accept: 'image/*' })
files.forEach((f) => console.log(f.url, f.meta.alt))

// Open straight into the folder of a File the field already holds:
const url = await openFileManager({ accept: 'image/*', path: input.value })
```

All three open the **shared singleton instance** (created lazily if the page didn't place a
`<file-manager>`), resolve on selection, and **reject** if the user closes without choosing.

### Events

The element emits two `bubbles: true, composed: true` events. `selectfile` carries a uniform
[`SelectDetail`](src/types.ts): `detail.url` (the first File's url, always present for backward
compatibility) plus `detail.files` (the full **Selection** as `FileItem[]`).

```js
const el = document.querySelector('file-manager')

el.addEventListener('selectfile', (e) => {
  console.log(e.detail.url) // string — first File's url
  console.log(e.detail.files) // FileItem[] — full selection with meta
})

el.addEventListener('close', () => {
  // fired whenever the manager closes (including after a selection)
})
```

You can also drive the element directly via its methods: `el.show(options)`, `el.close()`,
`el.reset()`.

## Attributes & options

### Element attributes (`<file-manager …>`)

| Attribute    | Type                        | Default | Description                                                                     |
| ------------ | --------------------------- | ------- | ------------------------------------------------------------------------------- |
| `endpoint`   | string                      | `''`    | Base URL of the REST contract (falls back to the `register()` endpoint).        |
| `layout`     | `grid` \| `rows`            | `grid`  | Initial file listing layout.                                                    |
| `readonly`   | boolean                     | `false` | Hide all mutating actions (upload, delete, rename, crop, new folder, drag).     |
| `multiple`   | boolean                     | `false` | Allow choosing several Files.                                                   |
| `accept`     | string                      | `''`    | Mime/extension filter, e.g. `image/*` or `.jpg,.png`.                           |
| `crop-ratio` | string \| number            | `''`    | Constrain the crop editor: `"16:9"`, `"1:1"`, a number, or `"free"`.            |
| `theme`      | `auto` \| `light` \| `dark` | `auto`  | `auto` bridges daisyUI / `prefers-color-scheme`; `light` / `dark` force a look. |
| `lang`       | `en` \| `fr`                | `en`    | UI language (also settable globally via `register({ lang })`).                  |

### Per-open options (`OpenOptions`)

`accept`, `multiple`, `cropRatio`, and `path` can also be passed per call — to `el.show(options)`
or to `openFileManager*(options)`. Because there is a single shared instance, these are **applied
on open and reset on close**, so each invocation starts clean:

```js
el.show({ accept: 'image/*', multiple: true, cropRatio: '16:9' })
```

| Option      | Type             | Effect                                                                                |
| ----------- | ---------------- | ------------------------------------------------------------------------------------- |
| `accept`    | string           | Mime/extension filter for the picker (`image/*`, `.jpg,.png`).                        |
| `multiple`  | boolean          | Allow choosing several Files.                                                         |
| `cropRatio` | string \| number | Constrain the crop editor (`"16:9"`, `"1:1"`, a number, `"free"`).                    |
| `path`      | string           | A file url/path the field already holds; the picker **opens in that File's folder**.  |

#### Opening in the right folder (`path`)

Pass the field's current value as `path` and the picker opens straight into the folder that holds
it, with the tree expanded down to that folder and the folder selected. Resolution is
**prefix-agnostic** — it matches the deepest **Folder** whose `id` is a suffix of the url's
directory, so it works whether your urls look like `/uploads/…`, `/uploads/media/…`, or absolute
CDN urls; if nothing matches it falls back to the root.

The declarative `data-filemanager` fields and `data-open-file-manager` triggers **already do this
for you** — no change needed. The only place to wire it yourself is a **programmatic** integration
that opens the picker with a value already in hand — e.g. a visual-editor image field. Forward the
url it gives you as `path`:

```js
// @charlie404/visual-editor (or any `onBrowse: (url?) => Promise<string>` field):
//   before: onBrowse: () => openFileManager({ accept: 'image/*' })
//   after:  forward the current url so the picker lands in its folder
onBrowse: (url) => openFileManager({ accept: 'image/*', path: url })
```

Everything else is backward-compatible: omit `path` and the picker opens at the root with a
fully-collapsed tree, as before.

## Theming

Internally the element only uses its own `--fm-*` custom properties, each defined as a daisyUI
token with a hard-coded fallback, e.g. `--fm-surface: var(--color-base-100, #fff)`. Because CSS
custom properties inherit _across_ the Shadow DOM boundary:

- **Inside a daisyUI app**, the element automatically adopts whatever `data-theme` is active on
  `<html>` — no wiring needed.
- **Outside daisyUI**, the light fallbacks apply, overridden by a built-in
  `@media (prefers-color-scheme: dark)` block.
- **Any host** can override the `--fm-*` variables directly, or force a fixed look with the
  `theme="light|dark"` attribute.

```css
/* Override individual tokens from the host page */
file-manager {
  --fm-primary: #ff5a36;
  --fm-radius-field: 10px;
}
```

See [ADR 0002](docs/adr/0002-theming-via-daisyui-token-bridge.md) for why the daisyUI bridge is
preferred over `prefers-color-scheme` alone (the OS pref ignores the app's own theme toggle).

## The backend contract

The lib is **JS-only** — it does not own server-side storage, crop computation, or metadata
persistence; it only fixes their shapes (see [ADR 0003](docs/adr/0003-js-only-per-host-contract-no-bundle.md)).
You implement these routes under your `endpoint`. The reference implementation is
[`server/router.php`](server/router.php) (a single-file PHP server over a plain filesystem),
mirrored by `examples/{symfony,laravel,vanilla}`.

### Endpoints

| Method & path          | Body / query                | Returns      | Purpose                                        |
| ---------------------- | --------------------------- | ------------ | ---------------------------------------------- |
| `GET /folders`         | —                           | `Folder[]`   | List all folders (the navigation tree).        |
| `POST /folders`        | `{ name, parent }`          | `Folder`     | Create a folder.                               |
| `PUT /folders/{id}`    | `{ name }`                  | `Folder`     | Rename a folder.                               |
| `DELETE /folders/{id}` | —                           | `204`        | Delete a folder (recursively).                 |
| `GET /files`           | `?folder={id}`              | `FileItem[]` | List Files in a folder (root if omitted).      |
| `POST /files`          | multipart: `file`, `folder` | `FileItem`   | Upload a File.                                 |
| `POST /files/move`     | `{ from, to }`              | `FileItem`   | Move a File to another folder.                 |
| `POST /files/crop`     | `CropParams`                | `FileItem`   | Produce a **Derivative** (a new cropped File). |
| `PUT /files/{id}`      | `{ name?, meta? }`          | `FileItem`   | Rename and/or update Metadata.                 |
| `DELETE /files/{id}`   | —                           | `204`        | Delete a File.                                 |

`{id}` is the File or Folder's path under the storage root (e.g. `products/2024/photo.jpg`).
Errors return a JSON `{ "error": "…" }` with a `4xx` status.

### JSON shapes

```jsonc
// Folder
{ "id": "products/2024", "name": "2024", "parent": "products" } // parent null at root

// FileItem
{
  "id": "products/2024/photo.jpg",
  "name": "photo.jpg",
  "url": "/uploads/products/2024/photo.jpg",   // what the host ultimately consumes
  "folder": "products/2024",                    // null at root
  "thumbnail": "/uploads/…",                    // or a data: SVG placeholder for non-images
  "size": 51234,                                // bytes
  "mtime": 1718600000,                          // epoch seconds, optional (date sorting)
  "meta": { "alt": "A red racket", "title": "Pure Drive" }
}
```

### Crop payload (`POST /files/crop` → `CropParams`)

The client sends only the source id and a crop rectangle in the **natural pixels** of the source
image; the server writes a Derivative beside the source and returns it as a `FileItem`.

```jsonc
{
  "source": "products/photo.jpg",
  "crop": { "x": 120, "y": 80, "width": 800, "height": 450 },
  "format": "webp", // optional: "jpeg" | "png" | "webp" — omit to keep source format
  "quality": 0.82, // optional: 0..1 for lossy formats
  "maxWidth": 1600, // optional: downscale so output width never exceeds this
}
```

> **Metadata storage is the host's choice.** The contract only fixes the `meta` shape on
> `FileItem`. The reference server and examples persist it in a per-folder `.meta.json` sidecar
> (no database). Cropping is server-side (GD/Imagick in the PHP reference) and non-destructive.

## Custom backend

The default backend is a REST client (`createRestApi`) against the contract above. To talk to a
different API — or override just one operation — pass a partial `api` to `register()`; supplied
methods replace the REST defaults, the rest fall through to the contract:

```js
import { FileManager } from '@charlie404/filemanager'

FileManager.register('file-manager', {
  endpoint: '/admin/file-manager',
  headers: { 'X-CSRF-Token': csrf }, // sent on every request
  credentials: 'same-origin',
  api: {
    // override only what differs; everything else uses the REST contract
    async uploadFile(file, folder) {
      const body = new FormData()
      body.append('file', file)
      if (folder) body.append('folder', folder)
      const res = await fetch('/my/uploads', { method: 'POST', body })
      return res.json() // must resolve a FileItem
    },
  },
})
```

You can also build the REST client yourself and wrap it:

```js
import { createRestApi } from '@charlie404/filemanager'

const rest = createRestApi({ endpoint: '/admin/file-manager', credentials: 'include' })
FileManager.register('file-manager', { api: { ...rest, cropFile: myCustomCrop } })
```

The full method set to implement/override is the [`FileManagerApi`](src/types.ts) interface:
`getFolders`, `createFolder`, `renameFolder`, `deleteFolder`, `getFiles`, `uploadFile`,
`updateFile`, `moveFile`, `deleteFile`, `cropFile`.

## Development

```bash
npm run dev      # Vite demo harness on :3000 + the PHP reference server on :8000 (concurrently)
npm run build    # emit the self-contained ESM bundle + type declarations into dist/
npm test         # Playwright e2e suite against the demo harness
npm run test:headed
```

`npm run dev` runs Vite (serving `index.html` and proxying `/api` and `/uploads` to PHP) next to
`php -S 0.0.0.0:8000 server/router.php`. Override the API port with the **`FM_API_PORT`** env var
(and the dev-server port with `FM_PORT`); the Playwright suite reads `FM_API_PORT` too.

Requirements: Node 18+, and PHP 8.1+ with the GD extension for the reference crop server.

## Concepts

The shared vocabulary and the recorded design decisions:

- **[CONTEXT.md](CONTEXT.md)** — the domain glossary: **File**, **Folder**, **Selection**,
  **Metadata**, **Derivative**. Use these exact terms.
- **[ADR 0001](docs/adr/0001-server-side-non-destructive-crop.md)** — cropping is server-side and
  non-destructive: it writes a Derivative, never mutates the source.
- **[ADR 0002](docs/adr/0002-theming-via-daisyui-token-bridge.md)** — theming bridges daisyUI
  tokens through the Shadow DOM, with a `prefers-color-scheme` fallback.
- **[ADR 0003](docs/adr/0003-js-only-per-host-contract-no-bundle.md)** — JS-only distribution with
  a per-host REST contract (no Symfony bundle); the contract is the product surface.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the release history and what changed between versions.

## License

MIT © Charlie404
