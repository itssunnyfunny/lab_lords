import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  title: {
    default: "Lab Lords | Branch OS for Education Operators",
    template: "%s | Lab Lords",
  },
  description: siteConfig.description,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: absoluteUrl("/"),
  },
  keywords: [
    "education ERP",
    "branch management",
    "seat allocation",
    "fee tracking",
    "student management",
  ],
  openGraph: {
    type: "website",
    url: absoluteUrl("/"),
    siteName: siteConfig.name,
    title: "Lab Lords | Branch OS for Education Operators",
    description: siteConfig.description,
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Lab Lords - Study Hall & Coaching Management Software",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lab Lords | Branch OS for Education Operators",
    description: siteConfig.description,
    images: ["/twitter-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "1024x1024" },
    ],
    apple: [
      { url: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClerkProvider
          signInFallbackRedirectUrl="/app"
          signUpFallbackRedirectUrl="/app"
          afterSignOutUrl="/"
        >
          {children}
        </ClerkProvider>
        <Suspense fallback={null}>
          <AnalyticsProvider measurementId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        </Suspense>
      </body>
    </html>
  );
}
