# Changelog

All notable changes to **@charlie404/filemanager** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Versioning note.** The package is in the `0.x` line — _initial development_ per semver: the
> public API is not yet declared stable and may change between minor versions. New features bump
> the **minor** (`0.x.0`), fixes bump the **patch** (`0.0.x`). The first stable contract will ship
> as `1.0.0`.

## [Unreleased]

## [0.3.0] - 2026-06-19

### Changed

- **Sidebar folder names** now stay on one line and use a **middle ellipsis** (macOS Finder style)
  when they overflow — the start and end of the name stay readable instead of wrapping. The cut
  point re-measures on resize, and the full name is available as a hover tooltip / accessible label.
- **The breadcrumb** no longer wraps to multiple lines: it stays on a single line and scrolls
  horizontally (kept scrolled to the current folder), and any individual segment that is too long
  middle-truncates the same way as the sidebar.
- The **delete-folder** button in the tree is now shown **only on the active folder** (and never on
  Home), keeping the sidebar uncluttered; it is now keyboard-operable (focusable, activates on
  Enter / Space).

### Fixed

- The main toolbar and the sidebar **New folder** bar now line up: a native `<select>` rendered a
  couple of pixels taller than the buttons, which offset the two bottom borders.

## [0.2.0] - 2026-06-18

### Added

- **Collapsible folder tree.** Each folder with children shows a chevron to fold/unfold it, and the
  sidebar tree now opens **fully collapsed**, so deep hierarchies stay tidy. Clicking a folder to
  open it also expands it.
- **Open in the right folder** — a new `path` per-open option (`OpenOptions`). Pass a file url/path
  the host field already holds and the picker opens **straight into that File's folder**, expanding
  the tree down to it and selecting it. Resolution is prefix-agnostic (works with `/uploads/…`,
  `/uploads/media/…`, or absolute CDN urls; falls back to the root when nothing matches). The
  declarative `data-filemanager` fields and `data-open-file-manager` triggers forward the field's
  current value **automatically** — no code change. Programmatic callers (e.g. a visual-editor
  `onBrowse: (url) => …`) opt in by passing `path`.
- The **New folder** prompt now shows which folder the new folder will be created in (muted text on
  the title line).

### Changed

- The sidebar **New folder** action is pinned (sticky) at the top of the sidebar, above a full-bleed
  divider that mirrors the main toolbar.
- Each time the manager opens it starts at the **root with a fully-collapsed tree** (unless a `path`
  is supplied). Previously it reopened on the last-visited folder with the whole tree expanded.

## [0.1.0] - 2026-06-17

### Added

- Initial release: the framework-agnostic `<file-manager>` custom element — a modal media browser
  with folder navigation, upload, drag-and-drop (including recursive folder import from
  Finder/Explorer), move, rename, delete (incl. bulk), search, sort, and grid/rows layouts.
- Single and multiple selection (`name[]` chips), per-File **Metadata** (`alt` / `title`) editing,
  an `accept` filter, and typed file-extension glyphs for non-images.
- **Server-side, non-destructive cropping** (produces a Derivative beside the source).
- **Automatic theming** via a daisyUI token bridge with a `prefers-color-scheme` fallback.
- **Runtime i18n** (English + French), inferred from `<html lang>` and switchable live.
- A documented per-host **REST contract** with Symfony, Laravel, and vanilla reference servers, plus
  a drop-in superset of Grafikart's `data-open-file-manager` trigger and `selectfile` event.

[Unreleased]: https://github.com/charlie404/filemanager/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/charlie404/filemanager/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/charlie404/filemanager/releases/tag/v0.1.0
