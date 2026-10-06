/**
 * Gallery — SERVER component.
 *
 * The route is removed from a production build by calling `notFound()`, so the
 * gallery is never served and never prerendered.
 *
 * This replaced a runtime `return null`, which was NOT a gate. That version
 * passed every unit test and still shipped: the route was registered at
 * /gallery and its component source was present in the production JS chunks.
 * Verified by building and grepping the output, which is the only way this class
 * of defect is caught — see design/BUILD_CONTINUATION.md.
 *
 * The gallery UI itself is a client component, imported statically so Next keeps
 * it out of the server graph. In production this module is never rendered, so the
 * page and its 404 are all that ship from here.
 *
 * Verification that must be repeated after any change to this file:
 *   pnpm --filter @pass/web build
 *   grep the .next js chunks for "narrow-width stress"
 *   -> must return nothing
 */
import { notFound } from "next/navigation";

import { isGalleryEnabled } from "./gating";
import { GalleryClient } from "./gallery-client";

export default function GalleryPage() {
  if (!isGalleryEnabled()) {
    // Removes the route from the production build rather than hiding it.
    notFound();
  }
  return <GalleryClient />;
}
