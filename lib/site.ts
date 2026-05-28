export const siteConfig = {
  name: "Lab Lords",
  shortName: "Lab Lords",
  description: "Micro-ERP for offline education businesses that run seats, shifts, fees, staff permissions, and owner-approved AI follow-ups.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lablords.in").replace(/\/$/, ""),
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "lablords.in@gmail.com",
};

export function absoluteUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteConfig.url}${normalizedPath}`;
}
