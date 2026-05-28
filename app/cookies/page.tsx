import type { Metadata } from "next";
import { CookieSettingsButton } from "@/components/analytics/CookieSettingsButton";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { absoluteUrl } from "@/lib/site";

const updatedAt = "May 26, 2026";

const sections: LegalSection[] = [
  {
    title: "What cookies are",
    body: "Cookies and similar browser storage help websites remember sessions, preferences, and usage choices. Lab Lords uses essential cookies for account and security workflows, and optional analytics cookies when you accept them.",
  },
  {
    title: "Essential cookies",
    body: "Essential cookies are required for authentication, account sessions, security, routing, and saved preferences. The service may not work correctly without them.",
  },
  {
    title: "Analytics cookies",
    body: "Analytics cookies help us understand page views and product usage patterns so we can improve reliability and user experience. These are loaded only after you accept optional analytics cookies.",
  },
  {
    title: "Managing choices",
    items: [
      "Use the cookie banner or the button below to accept or reject optional analytics cookies.",
      "You can also clear site data from your browser settings to reset your cookie choice.",
      "Rejecting optional analytics does not block essential authentication or security cookies.",
    ],
  },
];

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How Lab Lords uses essential cookies and optional analytics cookies, and how to manage cookie choices.",
  alternates: {
    canonical: absoluteUrl("/cookies"),
  },
};

export default function CookiesPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Cookie Policy"
      description="This page explains how Lab Lords uses essential cookies and optional analytics cookies."
      updatedAt={updatedAt}
      sections={sections}
    >
      <CookieSettingsButton className="mt-4 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-button-secondary-border)] bg-[color:var(--ui-button-secondary-bg)] px-4 py-2 text-[color:var(--ui-button-secondary-text)]">
        Open cookie preferences
      </CookieSettingsButton>
    </LegalPage>
  );
}
