# Server-side, non-destructive crop derivative

Cropping is computed on the server via a new `POST {endpoint}/files/crop` endpoint that
writes a **Derivative** — a brand-new File next to the source — and leaves the source
untouched. The client only sends the source id and a crop rectangle in the source image's
natural pixels; the **Selection** then returns the Derivative's url, so the existing
"a chosen File yields a url" contract is unchanged.

## Considered options

- **Client-side crop, uploaded as a new file via the existing `POST /files`.** Zero new
  backend surface — the current controller would work as-is and every example backend stays
  trivial. Rejected because re-encoding in the browser loses quality, strips EXIF, and forces
  large originals fully into browser memory. For a media manager, output quality wins.
- **Destructive crop (overwrite the source).** Rejected: it destroys the original, so the
  same image can't be re-cropped differently and every other place that reuses the file is
  silently affected.
- **Store crop coordinates as metadata, apply at render.** Rejected: it breaks the URL-string
  contract — the visual-editor image field, the `selectfile` consumers and the Twig render
  layer would all have to change to carry and apply crop params.

## Consequences

The backend contract is a superset of Grafikart's: hosts must implement `/files/crop` with an
image library (GD/Imagick). Derivatives are first-class Files in the same folder, so a folder
can accumulate several crops of one source — that is intended (see the **Derivative** term in
CONTEXT.md), not a leak.
