import { siteConfig } from "@/lib/site";

export const publicPreviewAlt = "Lab Lords — A simpler way to manage your library. lablords.in";

// Next.js replaces nested metadata objects, so every public page supplies images.
export const publicOpenGraph = {
  siteName: siteConfig.name,
  images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: publicPreviewAlt }],
};

export const publicTwitter = {
  images: [{ url: "/twitter-image.png", width: 1200, height: 630, alt: publicPreviewAlt }],
};
