/**
 * The gallery route.
 *
 * This file is deliberately empty of gallery code. It re-exports through the
 * `#gallery` specifier, which `next.config.mjs` aliases to `./stub` in
 * production, so a production build never resolves — and therefore never bundles
 * — the gallery implementation.
 *
 * Do NOT import the implementation directly from here. A direct relative import
 * would bypass the alias and reintroduce the leak.
 */
export { default } from "pass-gallery";
