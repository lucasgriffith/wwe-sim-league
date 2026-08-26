/* eslint-disable @next/next/no-img-element */
// Server-component only (uses node crypto for Wikimedia CDN paths)
import Image from "next/image";
import { createHash } from "crypto";

/**
 * Wikimedia images are served straight from Wikimedia's own thumbnail CDN as
 * plain <img> — each visitor's browser fetches a small pre-generated thumb,
 * with no Vercel optimizer in the middle (whose single-IP fetches Wikimedia
 * rate-limits hard). Supabase-hosted uploads go through next/image. Anything
 * else (arbitrary pasted URLs) falls back to a plain lazy img, since
 * next/image throws on hosts it doesn't know.
 */

// Wikimedia only generates thumbs at these widths (returns 400 otherwise)
const WIKIMEDIA_THUMB_SIZES = [120, 250, 330, 500, 960];

export function extractWikimediaFilename(url: URL): string | null {
  if (url.hostname === "commons.wikimedia.org") {
    if (url.pathname.startsWith("/wiki/Special:FilePath/")) {
      return decodeURIComponent(
        url.pathname.slice("/wiki/Special:FilePath/".length)
      );
    }
    if (url.pathname === "/w/index.php") {
      const title = url.searchParams.get("title");
      if (title?.startsWith("Special:Redirect/file/")) {
        return title.slice("Special:Redirect/file/".length);
      }
    }
    return null;
  }
  if (url.hostname === "upload.wikimedia.org") {
    const m = url.pathname.match(/^\/wikipedia\/commons\/[0-9a-f]\/[0-9a-f]{2}\/([^/]+)$/);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

function wikimediaThumbUrl(url: URL, intrinsicWidth: number): string | null {
  const file = extractWikimediaFilename(url);
  if (!file) return null;
  const name = file.replace(/ /g, "_");
  const md5 = createHash("md5").update(name, "utf8").digest("hex");
  // Callers pass 2x display width; pick the smallest bucket that covers it
  const bucket =
    WIKIMEDIA_THUMB_SIZES.find((s) => s >= intrinsicWidth) ?? 960;
  const enc = encodeURIComponent(name);
  const base = `https://upload.wikimedia.org/wikipedia/commons/thumb/${md5[0]}/${md5.slice(0, 2)}/${enc}/${bucket}px-${enc}`;
  return /\.svg$/i.test(name) ? `${base}.png` : base;
}

export function SmartImage({
  src,
  alt,
  width,
  height,
  className,
  sizes,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  sizes?: string;
}) {
  try {
    const url = new URL(src, "https://invalid.local");
    const thumb = wikimediaThumbUrl(url, width);
    if (thumb) {
      return <img src={thumb} alt={alt} className={className} loading="lazy" />;
    }
    if (url.hostname.endsWith(".supabase.co") || src.startsWith("/")) {
      return (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          className={className}
        />
      );
    }
  } catch {
    // fall through to plain img
  }
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}
