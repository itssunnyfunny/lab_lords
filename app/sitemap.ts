import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

const staticRoutes = [
  { path: "/", priority: 1 },
  { path: "/privacy", priority: 0.4 },
  { path: "/terms", priority: 0.4 },
  { path: "/cookies", priority: 0.4 },
  { path: "/support", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return staticRoutes.map(route => ({
    url: absoluteUrl(route.path),
    lastModified,
    changeFrequency: route.path === "/" ? "weekly" : "monthly",
    priority: route.priority,
  }));
}
