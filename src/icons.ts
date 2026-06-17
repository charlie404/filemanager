import { svg, type SVGTemplateResult } from 'lit'

// Minimal inline icon set (lucide-derived, MIT). 24x24, currentColor stroke.
const wrap = (paths: SVGTemplateResult, size = 18) => svg`
  <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

export const icons = {
  folder: (s?: number) =>
    wrap(svg`<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>`, s),
  folderPlus: (s?: number) =>
    wrap(svg`<path d="M12 10v6m-3-3h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>`, s),
  upload: (s?: number) =>
    wrap(svg`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>`, s),
  search: (s?: number) =>
    wrap(svg`<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`, s),
  x: (s?: number) => wrap(svg`<path d="M18 6 6 18M6 6l12 12"/>`, s),
  crop: (s?: number) =>
    wrap(svg`<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>`, s),
  edit: (s?: number) =>
    wrap(svg`<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>`, s),
  trash: (s?: number) =>
    wrap(svg`<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>`, s),
  copy: (s?: number) =>
    wrap(svg`<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`, s),
  link: (s?: number) =>
    wrap(svg`<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`, s),
  check: (s?: number) => wrap(svg`<path d="M20 6 9 17l-5-5"/>`, s),
  chevronRight: (s?: number) => wrap(svg`<path d="m9 18 6-6-6-6"/>`, s),
  image: (s?: number) =>
    wrap(svg`<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>`, s),
  grid: (s?: number) =>
    wrap(svg`<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>`, s),
  list: (s?: number) =>
    wrap(svg`<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>`, s),
  home: (s?: number) =>
    wrap(svg`<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>`, s),
  download: (s?: number) =>
    wrap(svg`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>`, s),
}
