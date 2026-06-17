# Theme by bridging daisyUI tokens through the Shadow DOM

The element renders in Shadow DOM and defines its internal design tokens as
`--fm-surface: var(--color-base-100, <light-default>)`, `--fm-fg: var(--color-base-content,
<light-default>)`, and so on. CSS custom properties inherit across the shadow boundary, so
inside a daisyUI back-office the element automatically adopts whichever `data-theme` is active
(light, dark, dim, material-dark, contrast, …) with zero configuration. Outside daisyUI
(the laravel/vanilla examples) the `<light-default>` fallbacks apply, overridden by a
`@media (prefers-color-scheme: dark)` block, and any host can override `--fm-*` directly.

## Why this is recorded

A future reader will see `var(--color-base-100, …)` inside a self-contained component and
wonder where those variables come from — they are daisyUI 5 / Tailwind 4 theme tokens set on
`<html data-theme>`, relied on implicitly. Relatedly, the deliberate choice to NOT follow
`prefers-color-scheme` alone matters: the OS pref ignores the app's own theme toggle, so an
admin switching to "dark" in the topbar while the OS is light would otherwise desync.

## Considered options

- **`prefers-color-scheme` only.** Rejected: ignores the app's manual theme toggle → visible
  desync with the back-office.
- **A `theme="light|dark"` attribute the host must wire to its toggle.** Kept as an optional
  override, but rejected as the primary mechanism: it only yields two looks and cannot match
  dim/material/contrast automatically.
