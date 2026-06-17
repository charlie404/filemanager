# @charlie404/filemanager

A framework-agnostic custom element that lets an admin browse, upload, organise and crop
media stored on a server, then hand a chosen file's URL back to the host page. Distributed
as an npm package with a PHP dev server and `examples/{symfony,laravel,vanilla}`; the REST
backend is implemented per host project against a documented contract. This file names the
concepts that recur across the lib so front and back stay aligned.

## Language

**File Manager**:
The `<file-manager>` custom element — a modal media browser mounted once on a page and
toggled open. Owns folder navigation, file listing, upload, deletion and cropping, and emits
a chosen file back to the host.
_Avoid_: gallery, picker, modal, widget.

**File**:
One stored media item, identified by an `id` (its path under the storage root) and exposing
`name`, `url`, `folder`, `thumbnail`, `size` and **Metadata**. The `url` is what the host
ultimately consumes; the rest travels with it.
_Avoid_: media, asset, attachment, document.

**Metadata**:
The editable descriptive fields carried by a **File** — currently `alt` and `title`. Stored
however the backend chooses (the bundled examples use a per-folder sidecar JSON, so no
database is required); the lib only fixes the contract. Read with the **File** and written
back with `PUT`.
_Avoid_: tags, attributes, properties, EXIF (EXIF is read from the image; Metadata is authored).

**Folder**:
A directory under the storage root, identified by an `id` (its path), with a `name` and a
`parent`. Folders form the navigation tree.
_Avoid_: directory, category, album.

**Selection**:
The act of the user choosing one or more **File**s; surfaced to the host as the chosen
**File** object(s) — `url` plus `name` and **Metadata** — via the `selectfile` event and the
resolved value of the visual-editor `onBrowse` promise. `detail.url` (the first File's url)
is always present for backward compatibility; richer fields (`alt`, `title`) ride alongside.
Single-**File** by default; multi-**File** under an explicit multiple mode.
_Avoid_: pick, choose, attach.

**Derivative**:
A new **File** produced by cropping an existing one. Non-destructive: the source File is
kept untouched and the Derivative is a distinct File with its own `url`, which is what the
**Selection** then returns. Cropping never mutates or replaces the source.
_Avoid_: crop result, variant, thumbnail (a thumbnail is a preview, not a Derivative),
edited image.

## Example dialogue

> **Dev:** If I crop a hero photo to a square, what does the visual editor's image field end
> up storing?
>
> **Domain expert:** A URL — same as always. Cropping produces a **Derivative**: a brand new
> **File** next to the original. The original stays, the Derivative gets its own `url`, and
> that Derivative's url is what the **Selection** hands back. The field never knows a crop
> happened; it just receives a string.
>
> **Dev:** So I could crop the same original three different ways?
>
> **Domain expert:** Exactly — three Derivatives, one source, all independent Files.
