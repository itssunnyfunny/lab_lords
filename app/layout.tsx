import { publicOpenGraph, publicTwitter } from "@/lib/publicSocialMetadata";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { UserPreferencesBoundary } from "@/components/settings/UserPreferencesBoundary";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { AttendanceCameraBoundary } from "@/components/attendance/AttendanceCameraBoundary";
import { getGoogleAnalyticsBootstrapScript } from "@/lib/tracking";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { clerkRouting } from "@/lib/clerkRouting";
import { Geist_Mono, Inter, Manrope, Noto_Sans_Devanagari } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import { clerkAppAppearance } from "@/components/ui/entrySurface";
import "./globals.css";
import { publicStrings } from "@/lib/public-i18n/server";
import { publicLanguageTags } from "@/lib/public-i18n/routes";
import { PublicDraftProvider } from "@/components/landing/PublicDraftProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  title: {
    default: siteConfig.homeTitle,
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
    "library management software",
    "branch management",
    "seat allocation",
    "fee tracking",
    "student management",
  ],
  openGraph: {
    ...publicOpenGraph,
    type: "website",
    url: absoluteUrl("/"),
    siteName: siteConfig.name,
    title: siteConfig.homeTitle,
    description: siteConfig.description,
  },
  twitter: {
    ...publicTwitter,
    card: "summary_large_image",
    title: siteConfig.homeTitle,
    description: siteConfig.description,

  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const { locale } = await publicStrings();

  return (
    <html lang={publicLanguageTags[locale]} className="dark">
      <head>
        {measurementId ? (
          <Script
            id="google-analytics-consent-default"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: getGoogleAnalyticsBootstrapScript(measurementId),
            }}
          />
        ) : null}
      </head>
      <body
        className={`${inter.variable} ${manrope.variable} ${geistMono.variable} ${devanagari.variable} antialiased`}
      >
        <ClerkProvider
          appearance={clerkAppAppearance}
          signInUrl={clerkRouting.signInUrl}
          signUpUrl={clerkRouting.signUpUrl}
          signInFallbackRedirectUrl="/app"
          signUpFallbackRedirectUrl="/app"
          afterSignOutUrl="/"
        >
          <PublicDraftProvider><UserPreferencesBoundary><AttendanceCameraBoundary>{children}</AttendanceCameraBoundary></UserPreferencesBoundary></PublicDraftProvider>
        </ClerkProvider>
        {measurementId && (
          <Script
            id="google-analytics"
            src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
            strategy="afterInteractive"
          />
        )}
        <Suspense fallback={null}>
          <AnalyticsProvider measurementId={measurementId} />
        </Suspense>
      </body>
    </html>
  );
}
