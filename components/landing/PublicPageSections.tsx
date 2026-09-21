import { publicStrings } from "@/lib/public-i18n/server";
import Link from "next/link";
import { WorkspaceCTA } from "./MarketingActions";

export async function PublicIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  const { t } = await publicStrings();
  return <section className="marketing-page-hero"><div className="marketing-container">
    <p className="marketing-eyebrow">{t(eyebrow)}</p>
    <h1 className="marketing-title mt-4">{t(title)}</h1>
    <p className="marketing-lead mt-5 max-w-2xl">{t(description)}</p>
  </div></section>;
}

export async function PublicClosing({ source, title = "Ready to bring your records together?", description = "Start with your first branch, or talk to us about what your library needs." }: { source: string; title?: string; description?: string }) {
  const { t, href: localHref } = await publicStrings();
  return <section className="marketing-section public-closing"><div className="marketing-container">
    <h2 className="marketing-title">{t(title)}</h2><p className="marketing-lead mt-4">{t(description)}</p>
    <div className="marketing-actions mt-7"><WorkspaceCTA source={source} /><Link href={localHref("/contact")} className="marketing-button-secondary">{t("Contact us")}</Link></div>
  </div></section>;
}
