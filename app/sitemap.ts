import { publicLocales, publicHref, translatedPublicPaths } from "@/lib/public-i18n/routes";
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { getSoftwarePagePath, activeSoftwarePageSlugs } from "@/lib/softwarePages";

const staticRoutes = [
  { path: "/", priority: 1 },
  { path: "/features", priority: 0.9 },
  { path: "/pricing", priority: 0.9 },
  { path: "/how-it-works", priority: 0.8 },
  { path: "/faq", priority: 0.7 },
  { path: "/about", priority: 0.6 },
  ...activeSoftwarePageSlugs.map(slug => ({
    path: getSoftwarePagePath(slug),
    priority: 0.8,
  })),
  { path: "/privacy", priority: 0.4 },
  { path: "/terms", priority: 0.4 },
  { path: "/refund-policy", priority: 0.5 },
  { path: "/shipping-delivery-policy", priority: 0.5 },
  { path: "/contact", priority: 0.6 },
  { path: "/cookies", priority: 0.4 },
  { path: "/support", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return staticRoutes.flatMap(route => (translatedPublicPaths as readonly string[]).includes(route.path)
    ? publicLocales.map(locale => ({ ...route, path: publicHref(locale, route.path) }))
    : [route]).map(route => ({
    url: absoluteUrl(route.path),
    lastModified,
    changeFrequency: route.path === "/" || route.path.startsWith("/software/") ? "weekly" : "monthly",
    priority: route.priority,
  }));
}
