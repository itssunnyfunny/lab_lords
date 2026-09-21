import { publicStrings } from "@/lib/public-i18n/server";
import Link from "next/link";
import { MarketingShell } from "@/components/landing/MarketingShell";
import { PublicIntro, PublicClosing } from "@/components/landing/PublicPageSections";
import { PublicFaqList } from "@/components/landing/PublicFaqList";
import { faqGroups } from "@/lib/publicFaqs";
import { publicMetadata } from "@/lib/publicMetadata";

export const metadata = publicMetadata("/faq", "Frequently Asked Questions", "Answers about Lab Lords features, plans, trial, setup, imports, branches and support for libraries and study halls.");

export default async function FaqPage() {
  const { t, href: localHref } = await publicStrings();
  return <MarketingShell><div className="public-reference-page public-faq">
    <PublicIntro eyebrow={t("Common questions")} title={t("A little clarity before you start.")} description={t("Find answers about daily library work, your first branch and the plan that fits. Each answer points to the next useful page.")} />
    <div className="marketing-container public-contents"><nav aria-label={t("FAQ topics")}>{faqGroups.map(group => <a key={group.id} href={`#${group.id}`}>{t(group.title)}</a>)}</nav></div>
    {faqGroups.map(group => <section key={group.id} id={group.id} className="marketing-section public-questions"><div className="marketing-container">
      <h2 className="marketing-title mb-8">{t(group.title)}</h2><PublicFaqList ids={group.ids} />
    </div></section>)}
    <section className="marketing-section"><div className="marketing-container public-two-column grid"><div><h2 className="marketing-title">{t("Already using Lab Lords?")}</h2><p className="marketing-lead mt-4">{t("For account problems or something that is not working, share the details through Support.")}</p></div><div className="marketing-actions"><Link className="marketing-button-secondary" href={localHref("/support")}>{t("Visit Support")}</Link><Link className="marketing-button-secondary" href={localHref("/pricing")}>{t("View pricing")}</Link></div></div></section>
    <PublicClosing source="faq_close" title={t("Have a question about your library?")} />
  </div></MarketingShell>;
}
