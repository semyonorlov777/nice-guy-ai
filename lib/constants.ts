export const DEFAULT_PROGRAM_SLUG = "nice-guy";
export const DEFAULT_REDIRECT = "/";
export const APP_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://nice-guy-ai.vercel.app";

export const ALLOWED_REDIRECT_PREFIXES = ["/program/", "/balance"] as const;

export function isAllowedRedirect(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes(":")) return false;
  if (path === "/") return true;
  return ALLOWED_REDIRECT_PREFIXES.some((prefix) => path.startsWith(prefix));
}
