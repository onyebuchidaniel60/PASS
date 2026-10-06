/**
 * Gallery production stub.
 *
 * Next.js builds every file under `app/` regardless of what a page renders at
 * request time, so a runtime `return null` and even a runtime `notFound()` both
 * left the route in the build manifest and the gallery source in `page.js`.
 * design/DESIGN.md §10.15 requires the gallery to be gated OUT of production,
 * and the plan calls an ungated dev route the defect that is invisible to every
 * other check in the track.
 *
 * `next.config.mjs` aliases the `#gallery` specifier to THIS module when
 * NODE_ENV is production, so the real implementation is never resolved and
 * never enters the bundle. This file is the whole gallery in a production build.
 */
import { notFound } from "next/navigation";

export default function GalleryPage(): never {
  notFound();
}
