"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { useTranslation } from "@/components/settings/LocalizedText";
import { PublicBrandLockup } from "@/components/landing/PublicBrandLockup";
import "@/styles/botanical-auth.css";

const valuePoints = [
  "Set up your first branch in a guided flow.",
  "Manage seats, shifts, students, and fees in one place.",
  "Keep staff access clear and controlled.",
] as const;

export function AuthPageShell({ children, mode, legal }: {
  children: ReactNode;
  mode: "sign-in" | "sign-up";
  legal?: ReactNode;
}) {
  const t = useTranslation();
  const isSignUp = mode === "sign-up";
  return <main className="botanical-auth">
    <header className="botanical-auth-header">
      <Link href="/" aria-label={t("Lab Lords home")} className="botanical-auth-brand"><PublicBrandLockup /></Link>
      <Link href="/" className="botanical-auth-back"><ArrowLeft size={16} aria-hidden="true" />{t.owned("Back to home")}</Link>
    </header>
    <div className="botanical-auth-layout">
      <aside className="botanical-auth-story">
        <p className="botanical-auth-eyebrow">{isSignUp ? t("Create your workspace") : t("Welcome back")}</p>
        <h1>{isSignUp ? t("Start with one branch. Grow from there.") : t("Continue running your branches with clarity.")}</h1>
        <p>{t("A focused workspace for the daily operations that keep your branch moving.")}</p>
        <ul>{valuePoints.map((point, index) => <li key={point}><CheckCircle2 size={18} aria-hidden="true" /><span>{t(!isSignUp && index === 0 ? "Return to branch dashboards and daily priorities." : point)}</span></li>)}</ul>
        <Image className="botanical-auth-foliage" src="/brand-reference/botanical-accent.webp" alt="" width={720} height={720} sizes="300px" />
      </aside>
      <section className="botanical-auth-form" aria-label={isSignUp ? t("Create account") : t("Sign in to continue to your workspace.")}>
        <div className="botanical-auth-mobile-intro"><p>{isSignUp ? t("Create your account. We will guide you through your first branch next.") : t("Sign in to continue to your workspace.")}</p></div>
        {children}
        {legal && <div className="botanical-auth-legal">{legal}</div>}
        <p className="botanical-auth-security"><ShieldCheck size={15} aria-hidden="true" />{t("Secure authentication and account recovery by Clerk.")}</p>
      </section>
    </div>
  </main>;
}
