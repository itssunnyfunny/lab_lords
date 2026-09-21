import { LANGUAGE_TAGS } from "@/lib/i18n/language";

export const publicLocales = ["en", "hi", "hinglish"] as const;
export type PublicLocale = typeof publicLocales[number];
export const publicLanguageTags = LANGUAGE_TAGS;
export const publicLanguageNames = { en: "English", hi: "हिंदी", hinglish: "Hinglish" } as const;
export const publicLanguageHeader = "x-lablords-public-language";
export const publicPathHeader = "x-lablords-public-path";
export const translatedPublicPaths = [
  "/", "/features", "/pricing", "/how-it-works", "/about", "/faq", "/contact", "/support",
  "/software/study-hall-management", "/software/library-management", "/software/seat-management",
  "/software/student-fee-management", "/software/fee-reminder",
] as const;
export const policyPaths = ["/privacy", "/terms", "/refund-policy", "/shipping-delivery-policy", "/cookies"] as const;
export const retiredPublicPaths = ["/software/coaching-management", "/software/tuition-management"] as const;
const translated = new Set<string>(translatedPublicPaths);
const englishOnly = new Set<string>([...policyPaths, ...retiredPublicPaths]);

export function publicRoute(pathname: string | null): { locale: PublicLocale; path: string; translated: boolean } | null {
  if (!pathname) return null;
  const path = pathname === "/" ? pathname : pathname.replace(/\/$/, "");
  if (translated.has(path)) return { locale: "en", path, translated: true };
  if (englishOnly.has(path)) return { locale: "en", path, translated: false };
  const match = /^\/(hi|hinglish)(\/.*)?$/.exec(path);
  if (!match || !translated.has(match[2] || "/")) return null;
  return { locale: match[1] as PublicLocale, path: match[2] || "/", translated: true };
}

/** Prefix only known marketing destinations. Auth, billing, assets and external links are untouched. */
export function publicHref(locale: PublicLocale, href: string): string {
  const match = /^(\/[^?#]*)([?#].*)?$/.exec(href);
  if (!match || !translated.has(match[1]) || locale === "en") return href;
  return `/${locale}${match[1] === "/" ? "" : match[1]}${match[2] || ""}`;
}

/** Only the existing public plan choice is carried across languages; never redirect or personal data. */
export function languageHref(locale: PublicLocale, pathname: string, search = "", hash = ""): string | null {
  const route = publicRoute(pathname);
  if (!route?.translated) return null;
  const query = new URLSearchParams(search);
  const plan = query.get("billingPlan");
  const kept = plan === "BASIC" || plan === "PRO" ? `?billingPlan=${plan}` : "";
  const fragment = /^#[A-Za-z][A-Za-z0-9_-]*$/.test(hash) ? hash : "";
  return `${publicHref(locale, route.path)}${kept}${fragment}`;
}

export function publicAlternates(path: string, absolute: (path: string) => string) {
  if (!translated.has(path)) return undefined;
  return {
    "en-IN": absolute(path), "hi-IN": absolute(publicHref("hi", path)),
    "hi-Latn-IN": absolute(publicHref("hinglish", path)), "x-default": absolute(path),
  };
}
