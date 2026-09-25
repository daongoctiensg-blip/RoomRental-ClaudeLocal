// Deployed at https://www.tiedohouse.com/phongchothue/ — a subpath of an
// existing site, not the domain root. Next.js's `basePath` config (see
// next.config.ts) automatically prefixes <Link> and next/navigation's
// router.push/replace, but it does NOT touch plain fetch() calls made from
// client components — those must be prefixed by hand, which is what this
// helper is for.
//
// Set NEXT_PUBLIC_BASE_PATH=/phongchothue in the VPS .env to enable. Leave
// it unset for local dev — the app then runs at "/" as before, no code
// changes needed either way.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function apiUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}

// Room/property images can be either a full external URL (an admin pasted
// e.g. an Unsplash link — leave those alone) or a root-relative path this
// app itself served via /api/upload (/api/uploads/<file>, /api/documents/
// file/<file>) — those need the same basePath prefix apiUrl() adds to
// fetch() calls, or they 404 once deployed under /phongchothue. Found live:
// real uploaded photos rendered as broken images on the VPS because the
// stored URL was the server's raw, un-prefixed response. Applying this at
// render time (rather than when the URL is first saved) means it also
// repairs any URL saved before this fix existed, not just new uploads.
export function assetUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  if (/^(https?:)?\/\//i.test(url) || url.startsWith("data:") || url.startsWith(BASE_PATH)) {
    return url;
  }
  return apiUrl(url);
}
