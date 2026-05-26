import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { absoluteUrl, siteConfig } from "@/lib/site";

const updatedAt = "May 26, 2026";

const sections: LegalSection[] = [
  {
    title: "Information we collect",
    items: [
      "Account information such as name, email address, phone number, authentication identifiers, and workspace preferences.",
      "Workspace information entered by you or your team, including organization, branch, student, seat, shift, payment, staff, import, audit, AI report, and message draft records.",
      "Support information such as bug reports, contact messages, and operational context you choose to share with us.",
      "Usage and device information such as pages visited, browser type, approximate location from network data, and event data when optional analytics cookies are accepted.",
    ],
  },
  {
    title: "How we use information",
    items: [
      "To provide the Lab Lords workspace, authenticate users, protect accounts, and keep branch data scoped to authorized users.",
      "To operate product workflows such as student management, seat allocation, fee tracking, staff permissions, imports, analytics, and AI-assisted drafting.",
      "To troubleshoot issues, respond to support requests, improve product reliability, and understand aggregate product usage.",
      "To comply with legal obligations, enforce our terms, prevent misuse, and protect the security of the service.",
    ],
  },
  {
    title: "Service providers",
    body: "We use trusted service providers to run the product, including authentication, hosting, database, analytics, email/support, payment, and AI infrastructure where enabled. These providers process data only for the services they provide to Lab Lords.",
  },
  {
    title: "Authentication and security",
    body: "Lab Lords uses Clerk for authentication. Account sessions, verification, password reset, and supported OAuth sign-in methods are handled through Clerk. We also maintain application-level authorization checks for organizations, branches, staff roles, and API access.",
  },
  {
    title: "Your choices",
    items: [
      "You can reject optional analytics cookies from the cookie banner or cookie settings.",
      "You can request access, correction, export, or deletion of your account and workspace data by contacting support.",
      "You are responsible for ensuring you have the right to upload or manage student, staff, and payment records in your workspace.",
    ],
  },
  {
    title: "Data retention",
    body: "We keep account and workspace data while your account or organization remains active, and for a reasonable period afterward where needed for backups, audits, dispute resolution, legal compliance, or service security.",
  },
  {
    title: "Contact",
    body: `For privacy requests or questions, contact ${siteConfig.supportEmail}.`,
  },
];

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Lab Lords collects, uses, and protects account, workspace, support, cookie, and analytics data.",
  alternates: {
    canonical: absoluteUrl("/privacy"),
  },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      description="This policy explains what Lab Lords collects, why it is used, and the choices available to workspace owners, staff, and users."
      updatedAt={updatedAt}
      sections={sections}
    />
  );
}
