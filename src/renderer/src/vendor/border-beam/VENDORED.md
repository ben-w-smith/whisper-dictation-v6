# Vendored: border-beam

This directory contains a vendored copy of the `border-beam` React library by
Jakub Antalik, used to render the animated bottom-edge aurora on our overlay
pill (via `size='line'` / `colorVariant='colorful'`).

## Provenance

| | |
|---|---|
| Upstream repo | https://github.com/Jakubantalik/border-beam |
| npm package | https://www.npmjs.com/package/border-beam |
| Upstream version | `1.0.1` |
| Upstream commit | `faa54282e662f852dde7f1273a6856690075bc14` |
| Vendored on | 2026-04-17 |
| License | MIT (see `./LICENSE`) |

## Why vendored (not a dependency)

1. It's a young one-maintainer library (~2 GH stars at time of vendor). Vendoring
   insulates us from supply-chain risk and the library disappearing.
2. We want to customize — specifically the `prefers-reduced-motion` handling,
   which upstream explicitly delegates to the consumer.
3. It's the only third-party React-UI dependency we'd pull into the renderer.
   Worth holding that line.

## Upgrade policy

Treat this directory as read-mostly. If upstream ships a bugfix or feature we
want, diff-apply it here and bump the provenance table above. Do not add new
features to these files — build them in wrapping components (e.g. `BeamPill.tsx`)
so the vendored surface stays portable.

## Scope caveat

These files sit **outside** the hex-color guard scope
(`src/renderer/src/components` and `src/renderer/src/views`). That's
intentional — upstream uses thousands of literal `rgb()` / `rgba()` values
in its generated CSS. Our design-token rules don't apply to third-party code.
