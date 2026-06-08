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
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "Lab Lords logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Lab Lords | Branch OS for Education Operators",
    description: siteConfig.description,
    images: ["/icon.png"],
  },
  icons: {
    icon: "/icon.png",
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
