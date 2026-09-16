import { permanentRedirect } from "next/navigation";

/**
 * Legacy duplicate Self Assessment article route.
 * Canonical content lives at /blogs/understanding-self-assessment-uk.
 * next.config.mjs also redirects /blog-details permanently.
 */
export default function BlogDetailsLegacyRedirect() {
  permanentRedirect("/blogs/understanding-self-assessment-uk");
}
