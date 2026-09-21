import type { Metadata } from "next";
import { absoluteUrl, siteConfig } from "@/lib/site";

export function publicMetadata(path: string, title: string, description: string): Metadata {
  return {
    title, description, alternates: { canonical: absoluteUrl(path) },
    openGraph: { type: "website", url: absoluteUrl(path), siteName: siteConfig.name, title: `Lab Lords ${title}`, description },
    twitter: { card: "summary_large_image", title: `Lab Lords ${title}`, description },
  };
}
