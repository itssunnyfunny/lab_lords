import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { isAuthBypassEnabled } from "@/lib/authMode";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Lab Lords",
  description: "Micro-ERP for Offline Education Businesses",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = isAuthBypassEnabled()
    ? children
    : <ClerkProvider>{children}</ClerkProvider>;

  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {content}
      </body>
    </html>
  );
}
