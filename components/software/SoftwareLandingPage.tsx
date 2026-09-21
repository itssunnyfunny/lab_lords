import { publicStrings } from "@/lib/public-i18n/server";
import Link from "next/link";
import { ArrowRight, Check, CircleCheck } from "lucide-react";
import { MarketingShell } from "@/components/landing/MarketingShell";
import { WorkspaceCTA } from "@/components/landing/MarketingActions";
import { getSoftwarePagePath, softwarePages, type SoftwarePage } from "@/lib/softwarePages";

export async function SoftwareLandingPage({ page }: { page: SoftwarePage }) {
  const { t, href: localHref } = await publicStrings();
  return (
    <MarketingShell>
      <div className="public-reference-page public-software">
      <section className="marketing-page-hero">
        <div className="marketing-container">
          <nav aria-label={t("Breadcrumb")} className="public-breadcrumb mb-8 flex flex-wrap items-center gap-2 text-sm text-[color:var(--text-secondary)]">
            <Link href={localHref("/")} className="underline-offset-4 hover:underline">{t("Home")}</Link>
            <span aria-hidden="true">/</span>
            <Link href={localHref("/#software")} className="underline-offset-4 hover:underline">{t("For your library")}</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{t(page.shortName)}</span>
          </nav>
          <div className="public-software-hero-grid grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="marketing-eyebrow">{t(page.eyebrow)}</p>
              <h1 className="marketing-title mt-4">{t(page.h1)}</h1>
              <p className="marketing-lead mt-5">{t(page.heroDescription)}</p>
              <div className="marketing-actions mt-7">
                <WorkspaceCTA source={`software_${page.slug}_hero`} />
                <Link href={localHref("/pricing")} className="marketing-button-secondary">{t("View pricing")}</Link>
              </div>
              <p className="marketing-plan-note mt-5">{t("For {audiences}.", { audiences: page.audience.map(audience => t(audience)).join(", ").toLowerCase() })}</p>
            </div>
            <div className="marketing-card public-software-highlights p-6 sm:p-8">
              <h2 className="mb-6 text-xl font-semibold">{t("Your daily work, together")}</h2>
              <div className="space-y-6">
                {page.heroHighlights.map(item => (
                  <div key={item.title} className="flex gap-4">
                    <CircleCheck size={21} className="mt-1 shrink-0 text-[color:var(--ui-form-accent)]" aria-hidden="true" />
                    <div><h3 className="font-semibold">{t(item.title)}</h3><p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">{t(item.description)}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="marketing-section public-software-features">
        <div className="marketing-container">
          <p className="marketing-eyebrow">{t("Features")}</p>
          <h2 className="marketing-title mt-3">{t(page.featureTitle)}</h2>
          <p className="marketing-lead mt-4 max-w-3xl">{t(page.featureDescription)}</p>
          <div className="marketing-grid mt-8">
            {page.features.map(feature => (
              <article key={feature.title} className="marketing-card p-6">
                <Check size={22} className="text-[color:var(--ui-form-accent)]" aria-hidden="true" />
                <h3 className="mt-5 text-lg font-semibold">{t(feature.title)}</h3>
                <p className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">{t(feature.description)}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 text-sm leading-7 text-[color:var(--text-secondary)]">{t("Staff access, advanced reports and AI assistance are included in Standard.")} <Link href={localHref("/pricing")} className="underline underline-offset-4">{t("Compare all plan features")}</Link>.</p>
          <Link href={localHref(page.featureHref)} className="marketing-text-link mt-4">{t("Read the related feature details")}</Link>
        </div>
      </section>
      <section className="marketing-section public-software-use-cases">
        <div className="marketing-container">
          <p className="marketing-eyebrow">{t("Using Lab Lords")}</p>
          <h2 className="marketing-title mt-3">{t(page.useCaseTitle)}</h2>
          <p className="marketing-lead mt-4 max-w-3xl">{t(page.useCaseDescription)}</p>
          <ol className="marketing-grid mt-8">
            {page.useCases.map((useCase, index) => (
              <li key={useCase.title} className="marketing-card p-6">
                <span className="marketing-eyebrow">0{index + 1}</span>
                <h3 className="mt-4 text-lg font-semibold">{t(useCase.title)}</h3>
                <p className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">{t(useCase.description)}</p>
              </li>
            ))}
          </ol>
          <div className="public-example mt-8"><strong>{t("Illustrative example:")} </strong>{t(page.example)}</div>
          <Link href={localHref("/how-it-works")} className="marketing-text-link mt-5">{t("See how to set up your first branch")}</Link>
        </div>
      </section>
      <section className="marketing-section public-questions">
        <div className="marketing-container">
          <p className="marketing-eyebrow">{t("Common questions")}</p>
          <h2 className="marketing-title mt-3">{t("About {solution}", { solution: t(page.shortName).toLowerCase() })}</h2>
          <div className="marketing-faq mt-8">
            {page.faqs.map(faq => <details key={faq.question}><summary>{t(faq.question)}<span aria-hidden="true">+</span></summary><p>{t(faq.answer)}</p></details>)}
          </div>
        </div>
      </section>
      <section id="related-software" className="marketing-section">
        <div className="marketing-container">
          <p className="marketing-eyebrow">{t("Explore more")}</p>
          <h2 className="marketing-title mt-3">{t("More ways to use Lab Lords")}</h2>
          <div className="marketing-grid mt-8">
            {page.relatedSlugs.map(slug => {
              const relatedPage = softwarePages[slug];
              return (
                <Link key={slug} href={localHref(getSoftwarePagePath(slug))} className="marketing-card flex flex-col p-6">
                  <h3 className="text-lg font-semibold">{t(relatedPage.shortName)}</h3>
                  <p className="mb-5 mt-3 flex-1 text-sm leading-7 text-[color:var(--text-secondary)]">{t(relatedPage.heroDescription)}</p>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--ui-form-accent)]">{t("Learn more")}<ArrowRight size={16} aria-hidden="true" /></span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      <section className="marketing-section public-closing">
        <div className="marketing-container">
          <h2 className="marketing-title">{t(page.ctaTitle)}</h2>
          <p className="marketing-lead mt-4">{t(page.ctaDescription)}</p>
          <div className="marketing-actions mt-7">
            <WorkspaceCTA source={`software_${page.slug}_close`} />
            <Link href={localHref("/contact")} className="marketing-button-secondary">{t("Contact us")}</Link>
          </div>
        </div>
      </section>
      </div>
    </MarketingShell>
  );
}
