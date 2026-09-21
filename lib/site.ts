export const siteConfig = {
  name: "Lab Lords",
  shortName: "Lab Lords",
  homeTitle: "Lab Lords — Library & Study Hall Management Software",
  description: "Manage students, seats, attendance and fees for your self-study library. Keep payments, receipts and upcoming fee dates organised with Lab Lords.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lablords.in").replace(/\/$/, ""),
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "lablords.in@gmail.com",
  businessAddress: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS?.trim() || "Business address available on request",
};

export function absoluteUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteConfig.url}${normalizedPath}`;
}
