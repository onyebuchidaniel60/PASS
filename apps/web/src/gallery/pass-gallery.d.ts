/**
 * Type declaration for the build-time-swapped gallery specifier.
 *
 * This is deliberately NOT a `paths` entry in tsconfig.json. Next.js injects
 * tsconfig `paths` into webpack's `resolve.alias`, and that injection OVERRIDES
 * an alias set in the `webpack()` hook — which is exactly the failure the first
 * two attempts hit: the hook demonstrably ran with NODE_ENV=production and the
 * gallery still shipped, because tsconfig's mapping to `impl.tsx` won.
 *
 * Declaring the module ambiently keeps TypeScript and typecheck working while
 * leaving module resolution entirely to the webpack alias in next.config.mjs,
 * which is the only thing that can decide at build time.
 */
declare module "pass-gallery" {
  const GalleryPage: () => JSX.Element;
  export default GalleryPage;
}
