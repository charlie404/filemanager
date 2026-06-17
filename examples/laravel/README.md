# Laravel backend for `@charlie404/filemanager`

A copy-pasteable Laravel 11 backend for the `<file-manager>` custom element. It
implements the full REST contract over the `public` disk — **no database, no
migrations**. Per-file metadata (`alt`, `title`) lives in a per-folder sidecar
`.meta.json`, and image cropping is done server-side with GD.

## Where the files go

Copy each file to the matching path in your Laravel app (paths are identical):

| File in this example | Copy to |
| --- | --- |
| `app/Http/Controllers/FileManagerController.php` | `app/Http/Controllers/FileManagerController.php` |
| `routes/filemanager.php` | `routes/filemanager.php` |
| `resources/js/filemanager.js` | `resources/js/filemanager.js` |
| `resources/views/_filemanager.blade.php` | `resources/views/_filemanager.blade.php` |

Then register the routes — add this to `routes/web.php`:

```php
require __DIR__ . '/filemanager.php';
```

The routes live under the `web` middleware group on purpose: the element's REST
client uses `fetch` with `credentials: 'same-origin'`, so it needs the session
cookie (and a CSRF token — see below).

## Storage: `php artisan storage:link`

Files are stored on the `public` disk under a `media/` directory, i.e. in
`storage/app/public/media`, and served at `/storage/media/...`. Create the
symlink once:

```bash
php artisan storage:link
```

This links `public/storage` → `storage/app/public`, so the `url` and
`thumbnail` returned by the API resolve to real, publicly served URLs. (If your
`public` disk uses a non-default `url`, the controller honours it via
`Storage::disk('public')->url(...)`.)

The `media/` directory is created lazily the first time a folder or upload is
written, so there is nothing else to set up.

## Install the npm package + build assets

```bash
npm i @charlie404/filemanager
```

`resources/js/filemanager.js` imports the package, registers the element,
forwards the CSRF token, and calls `bindFileManagers()`. Build it with Vite —
in `vite.config.js` make sure the entry is included:

```js
import { defineConfig } from 'vite'
import laravel from 'laravel-vite-plugin'

export default defineConfig({
  plugins: [
    laravel({
      input: ['resources/css/app.css', 'resources/js/app.js', 'resources/js/filemanager.js'],
      refresh: true,
    }),
  ],
})
```

Load it on pages that use the element:

```blade
@vite('resources/js/filemanager.js')
```

No CSS import is required — the element styles itself in Shadow DOM and the
binding chips inject their own stylesheet.

## CSRF (Laravel 11)

The mutating routes (`POST`/`PUT`/`DELETE`) run through the `web` group's
`VerifyCsrfToken` middleware, so each request must carry a valid CSRF token.
**The simplest correct approach is to send the token as a header — do not
disable CSRF.**

1. Render the token as a meta tag in your layout `<head>` (Laravel's default
   app layout already includes this):

   ```blade
   <meta name="csrf-token" content="{{ csrf_token() }}">
   ```

2. `resources/js/filemanager.js` reads that tag and passes it to `register()`:

   ```js
   const csrf = document.querySelector('meta[name="csrf-token"]')?.content ?? ''
   FileManager.register('file-manager', {
     endpoint: '/admin/file-manager',
     headers: csrf ? { 'X-CSRF-TOKEN': csrf } : {},
   })
   ```

Laravel's `VerifyCsrfToken` accepts the token from the `X-CSRF-TOKEN` header out
of the box, so no exemption is needed.

> If you would rather make the routes stateless instead, move the route group
> behind an `api`-style prefix without the `web` group (e.g. register it in a
> route file that uses only the `throttle`/`auth` middleware you want). Then drop
> the CSRF header. The header approach above keeps the routes session-protected
> and is recommended.

## Requirements

- **PHP GD extension** (not Imagick). The crop endpoint uses `imagecrop`,
  `imagescale`, and the GD encoders (`imagejpeg`/`imagepng`/`imagewebp`/
  `imagegif`). Verify with `php -m | grep -i gd`. WebP output additionally needs
  GD built with WebP support.
- Laravel 11, PHP 8.2+.

## The contract (under `admin/file-manager`)

```
GET    /folders                  -> [{id,name,parent}]
POST   /folders {name,parent}    -> {id,name,parent}
PUT    /folders/{id} {name}      -> {id,name,parent}
DELETE /folders/{id}             -> 204
GET    /files?folder=ID          -> [FileItem]
POST   /files (multipart: file, folder) -> FileItem
PUT    /files/{id} {name?, meta?} -> FileItem
POST   /files/move {from, to}    -> FileItem
DELETE /files/{id}               -> 204
POST   /files/crop {source, crop:{x,y,width,height}, format?, quality?, maxWidth?} -> FileItem
```

`FileItem = {id, name, url, folder, thumbnail, size, mtime, meta:{alt, title}}`,
where `id` is the path under the `media/` root (slashes allowed — the routes use
`->where('id', '.*')`). Cropping is non-destructive: a new
`<stem>-<w>x<h>.<ext>` derivative is written next to the source; the original is
kept. Format defaults to the source format; pass `format` (`jpeg`|`png`|`webp`)
and `quality` (0..1) to override.
