/**
 * Gallery — real implementation.
 *
 * Resolved through the `#gallery` specifier so `next.config.mjs` can replace it
 * with `./stub` in a production build. See stub.tsx for why the gate has to be
 * evaluated at build time rather than at request time.
 *
 * A server component: it decides whether the gallery exists at all, then hands
 * the interactive surface to the client component.
 */
import { notFound } from "next/navigation";

import { GalleryClient } from "./client";
import { isGalleryEnabled } from "./gating";

export default function GalleryPage() {
  if (!isGalleryEnabled()) {
    // Belt and braces. The build-time alias is the real gate; this means the
    // route still 404s if the alias is ever removed or misconfigured, rather
    // than silently serving a dev surface.
    notFound();
  }
  return <GalleryClient />;
}
