// Custom image loader that prepends the basePath (/admin) to local image paths.
// This is needed because with unoptimized: true, Next.js does NOT automatically
// prepend the basePath to src attributes, causing 404s on the live subpath deployment.

export default function adminImageLoader({
    src,
}: {
    src: string;
    width: number;
    quality?: number;
}): string {
    // Only prepend basePath to root-relative local paths (not external URLs)
    if (src.startsWith("/") && !src.startsWith("//") && !src.startsWith("/admin")) {
        return `/admin${src}`;
    }
    return src;
}
