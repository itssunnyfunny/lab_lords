import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site";
import { publicAlternates, publicHref, type PublicLocale } from "./routes";
import { publicCatalog } from "./catalog";
import { messagesFor, publicTranslator } from "./translate";

export function localizedPublicMetadata(locale: PublicLocale, path: string, original: Metadata): Metadata {
  const t = publicTranslator(messagesFor(publicCatalog, locale));
  const titleText = (source: string) => {
    if (t(source) !== source) return t(source);
    if (source.endsWith(" | Lab Lords")) return `${t(source.slice(0, -12))} | Lab Lords`;
    if (source.startsWith("Lab Lords ")) return `Lab Lords ${t(source.slice(10))}`;
    return source;
  };
  const title = typeof original.title === "string" ? titleText(original.title) : original.title && "absolute" in original.title ? { absolute: titleText(original.title.absolute) } : original.title;
  const url = absoluteUrl(publicHref(locale, path));
  const image = { url: `/public-social/${locale}.png`, width: 1200, height: 630, alt: t("Lab Lords — A simpler way to manage your library. lablords.in") };
  return {
    ...original, title, description: original.description ? t(original.description) : undefined,
    alternates: { canonical: url, languages: publicAlternates(path, absoluteUrl) },
    openGraph: { ...original.openGraph, type: "website", url, locale: locale === "en" ? "en_IN" : "hi_IN",
      title: typeof original.openGraph?.title === "string" ? titleText(original.openGraph.title) : undefined,
      description: original.openGraph?.description ? t(original.openGraph.description) : undefined,
      ...(locale !== "en" ? { images: [image] } : {}) },
    twitter: { ...original.twitter,
      title: typeof original.twitter?.title === "string" ? titleText(original.twitter.title) : undefined,
      description: original.twitter?.description ? t(original.twitter.description) : undefined,
      ...(locale !== "en" ? { images: [image] } : {}) },
  };
}
