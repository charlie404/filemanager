# JS-only distribution with a per-host REST contract (no Symfony bundle)

The library ships as a single framework-agnostic npm package (`@charlie404/filemanager`): the
`<file-manager>` custom element plus its wiring layer. It does NOT ship a Symfony bundle. The
REST backend is implemented per host against a documented contract, with reference
implementations under `examples/{symfony,laravel,vanilla}` and a PHP dev server for the lib's
own tests.

## Why this is recorded

The backend controller is copy-pasted across projects today, so the obvious "finished product"
move would be a Composer bundle that removes that duplication. We deliberately did **not** do
that. A future contributor will ask "why isn't there a bundle?" — the answer is that the lib
is open-source and framework-agnostic: a Symfony bundle would privilege one framework and
couple releases to Symfony's conventions, whereas a documented contract + per-framework
examples keeps the laravel and vanilla paths first-class.

## Consequences

The contract is the real product surface and must stay stable and well-documented. Symfony
users still carry their own controller (the starter-kit keeps and evolves it); the lib does not
own server-side storage, crop computation, or metadata persistence — it only fixes their shapes.
A Composer bundle remains a possible future addition layered on top of the same contract, not a
prerequisite.
