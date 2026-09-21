import { publicAlternates } from "@/lib/public-i18n/routes";
import type { Metadata } from "next";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { publicOpenGraph, publicTwitter } from "@/lib/publicSocialMetadata";

export function publicMetadata(path: string, title: string, description: string, absoluteTitle?: string): Metadata {
  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : title, description, alternates: { canonical: absoluteUrl(path), languages: publicAlternates(path, absoluteUrl) },
    openGraph: { ...publicOpenGraph, type: "website", url: absoluteUrl(path), siteName: siteConfig.name, title: absoluteTitle ?? `Lab Lords ${title}`, description },
    twitter: { ...publicTwitter, card: "summary_large_image", title: absoluteTitle ?? `Lab Lords ${title}`, description },
  };
}
