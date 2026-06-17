# Vanilla example — `@charlie404/filemanager`

The simplest possible standalone usage: a static HTML page plus a single-file
PHP backend that implements the full REST contract. No framework, no build
tooling for the example itself.

## Run it

From this directory:

```sh
php -S localhost:8000 api.php
```

Then open <http://localhost:8000/>.

That's it. PHP's built-in server uses `api.php` as a router, so **one process
serves everything**:

| Route             | Serves                                            |
| ----------------- | ------------------------------------------------- |
| `/`               | `index.html` (this page)                          |
| `/dist/index.js`  | the built library bundle (`../../dist/index.js`)  |
| `/uploads/...`    | uploaded files                                    |
| `/api/...`        | the REST contract (`/folders`, `/files`, …)       |

Because the page and the API are served from the **same origin**, there is no
proxy and no CORS to configure. This is the whole point of serving `index.html`
through PHP too: the browser, the bundle, the API and the uploaded files all
live on `http://localhost:8000`.

## Requirements

- **PHP 8.1+** (the backend uses `match`, enums-free but typed code).
- The **GD extension** — only needed for the server-side crop feature. Uploads,
  folders and metadata work without it; cropping returns a clear error if GD is
  missing.

## Build the bundle once

The page loads the library from `../../dist/index.js`, which `api.php` serves at
`/dist/index.js`. That file is produced by the library's build. From the **repo
root** (two levels up):

```sh
npm install
npm run build
```

This writes `dist/index.js`. If you'd rather not build, copy a prebuilt
`dist/index.js` into a `dist/` folder next to this README — but the default
route already points at the repo's `dist/`, so building once is enough.

If the bundle is missing, `/dist/index.js` returns a 404 with a one-line hint
telling you to run the build.

## What the page shows

- **Single field** — `data-filemanager`: a text input with an auto-injected
  browse button. Picking a file writes its `url` into the input.
- **Gallery field** — `data-filemanager-multiple`: chips backed by hidden
  `gallery[]` inputs, ready to submit in a form.
- **Programmatic** — a button calling `openFileManager({ accept: 'image/*' })`
  and printing the resolved URL.

## Two ways to use the library in your own project

**(a) npm + a bundler** (Vite, webpack, esbuild, …):

```js
import {
  FileManager,
  bindFileManagers,
  openFileManager,
} from '@charlie404/filemanager'

FileManager.register('file-manager', { endpoint: '/api' })
bindFileManagers()
```

**(b) a plain `<script type="module">`** importing the built bundle directly —
this is what `index.html` does, so the example runs with no build step on the
HTML side.

## The backend contract

`api.php` is a self-contained adaptation of the library's reference backend. It
stores files on disk under `uploads/` (created on first run) and keeps per-file
metadata in a `.meta.json` sidecar inside each folder — no database. File ids
are paths under the storage root; filenames are slugged and de-duplicated, and
crops are non-destructive (`<stem>-<w>x<h>.<ext>`). Every id is run through a
path-traversal guard so requests can never escape `uploads/`.
