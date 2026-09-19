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
