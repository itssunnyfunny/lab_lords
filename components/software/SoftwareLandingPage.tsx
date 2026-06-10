import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleHelp,
  Clock3,
  CreditCard,
  Grid3X3,
  KeyRound,
  Layers3,
  MessageSquareText,
  Network,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import { AppLogo } from "@/components/brand/AppLogo";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingReveal } from "@/components/landing/LandingReveal";
import {
  landingContainerClass,
  landingDescriptionClass,
  landingEyebrowClass,
  landingInsetClass,
  landingMutedTextClass,
  landingNavLinkClass,
  landingPanelClass,
  landingPrimaryButtonClass,
  landingRootClass,
  landingSecondaryButtonClass,
  landingSectionClass,
  landingSubtleTextClass,
  landingTitleClass,
} from "@/components/ui/landingSurface";
import {
  getSoftwarePagePath,
  softwarePages,
  type SoftwarePage,
} from "@/lib/softwarePages";

const problemIcons = [Layers3, Clock3, Network];
const featureIcons = [Grid3X3, Users, CreditCard, KeyRound, Building2, BarChart3];
const useCaseIcons = [CheckCircle2, WalletCards, MessageSquareText];

export function SoftwareLandingPage({ page }: { page: SoftwarePage }) {
  return (
    <main className={landingRootClass}>
      <header className="sticky top-0 z-50 border-b border-[color:var(--ui-panel-header-border)] bg-[color:var(--bg-app)]/90 backdrop-blur-xl">
        <div className={`${landingContainerClass} flex min-h-16 items-center justify-between gap-4 py-2`}>
          <Link href="/" aria-label="Lab Lords home">
            <AppLogo subtitle="Education operations" subtitleClassName="hidden sm:block" />
          </Link>
          <nav className="flex items-center gap-3 sm:gap-5">
            <Link href="/#software" className={`${landingNavLinkClass} hidden sm:inline`}>
              Software
            </Link>
            <Link href="/support" className={`${landingNavLinkClass} hidden md:inline`}>
              Contact
            </Link>
            <Link href="/sign-up" className={`${landingPrimaryButtonClass} landing-cta-shine h-10 px-3 sm:px-4`}>
              Start free
              <ArrowRight size={14} />
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-[color:var(--ui-panel-header-border)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_20%,rgba(6,182,212,0.16),transparent_28%),radial-gradient(circle_at_18%_84%,rgba(139,92,246,0.1),transparent_28%)]" />
        <div className={`${landingContainerClass} relative py-14 sm:py-20 lg:py-24`}>
          <nav aria-label="Breadcrumb" className={`${landingSubtleTextClass} mb-8 flex flex-wrap items-center gap-2 text-xs`}>
            <Link href="/" className="transition-colors hover:text-[color:var(--text-primary)]">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/#software" className="transition-colors hover:text-[color:var(--text-primary)]">Software</Link>
            <span aria-hidden="true">/</span>
            <span className="text-[color:var(--text-secondary)]">{page.shortName}</span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.75fr)] lg:items-center">
            <div>
              <div className="landing-reveal inline-flex items-center gap-2 rounded-full border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] px-3 py-1.5">
                <ShieldCheck size={14} className="text-[color:var(--ui-badge-cyan-text)]" />
                <span className={landingEyebrowClass}>{page.eyebrow}</span>
              </div>
              <h1 className="landing-reveal mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-[color:var(--text-primary)] [animation-delay:80ms] sm:text-5xl lg:text-6xl">
                {page.h1}
              </h1>
              <p className={`${landingDescriptionClass} landing-reveal mt-6 max-w-3xl text-base [animation-delay:160ms] sm:text-lg sm:leading-8`}>
                {page.heroDescription}
              </p>

              <div className="landing-reveal mt-7 flex flex-col gap-3 [animation-delay:240ms] sm:flex-row">
                <Link href="/sign-up" className={`${landingPrimaryButtonClass} landing-cta-shine`}>
                  Start with one branch
                  <ArrowRight size={16} />
                </Link>
                <Link href="/support" className={landingSecondaryButtonClass}>
                  Talk to Lab Lords
                </Link>
              </div>

              <div className="landing-reveal mt-7 flex flex-wrap gap-2 [animation-delay:320ms]">
                {page.audience.map(item => (
                  <span
                    key={item}
                    className="rounded-full border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-surface-bg)] px-3 py-1.5 text-xs font-medium text-[color:var(--text-secondary)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className={`${landingPanelClass} landing-reveal landing-animated-card p-5 [animation-delay:180ms] sm:p-6`}>
              <div className="mb-5 flex items-center justify-between gap-4 border-b border-[color:var(--ui-form-section-divider)] pb-4">
                <div>
                  <p className={landingEyebrowClass}>Operating view</p>
                  <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">What becomes easier</p>
                </div>
                <div className="landing-live-pulse flex h-11 w-11 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] text-[color:var(--ui-badge-cyan-text)]">
                  <BarChart3 size={19} />
                </div>
              </div>
              <div className="space-y-4">
                {page.heroHighlights.map((item, index) => (
                  <div key={item.title} className={`${landingInsetClass} landing-animated-card p-4`}>
                    <div className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--ui-badge-success-border)] bg-[color:var(--ui-badge-success-bg)] text-xs font-semibold text-[color:var(--ui-badge-success-text)]">
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">{item.title}</h3>
                        <p className={`${landingMutedTextClass} mt-1 text-sm leading-6`}>{item.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${landingSectionClass} overflow-hidden`}>
        <span className="landing-section-glow left-[8%] top-20 h-48 w-48 bg-rose-400/10" aria-hidden="true" />
        <div className={`${landingContainerClass} relative`}>
          <LandingReveal variant="left">
            <p className={landingEyebrowClass}>The operating problem</p>
            <h2 className={`${landingTitleClass} mt-3`}>{page.problemTitle}</h2>
            <p className={`${landingDescriptionClass} mt-4 max-w-3xl`}>{page.problemDescription}</p>
          </LandingReveal>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {page.problems.map((problem, index) => {
              const Icon = problemIcons[index] ?? Layers3;
              return (
                <LandingReveal key={problem.title} delay={80 + index * 70} className={`${landingPanelClass} landing-animated-card p-5`}>
                  <div className="flex h-11 w-11 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-badge-danger-border)] bg-[color:var(--ui-badge-danger-bg)] text-[color:var(--ui-badge-danger-text)]">
                    <Icon size={18} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-[color:var(--text-primary)]">{problem.title}</h3>
                  <p className={`${landingMutedTextClass} mt-3 text-sm leading-7`}>{problem.description}</p>
                </LandingReveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className={`${landingSectionClass} overflow-hidden bg-[color:var(--ui-form-muted-surface-bg)]`}>
        <span className="landing-section-glow right-[10%] top-24 h-52 w-52 bg-cyan-400/10 [animation-delay:1s]" aria-hidden="true" />
        <div className={`${landingContainerClass} relative`}>
          <LandingReveal variant="left">
            <p className={landingEyebrowClass}>Capabilities</p>
            <h2 className={`${landingTitleClass} mt-3`}>{page.featureTitle}</h2>
            <p className={`${landingDescriptionClass} mt-4 max-w-3xl`}>{page.featureDescription}</p>
          </LandingReveal>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {page.features.map((feature, index) => {
              const Icon = featureIcons[index] ?? CheckCircle2;
              return (
                <LandingReveal key={feature.title} delay={60 + index * 55} className={`${landingPanelClass} landing-animated-card p-5`}>
                  <Icon size={19} className="text-[color:var(--ui-tone-info-text)]" />
                  <h3 className="mt-4 text-base font-semibold text-[color:var(--text-primary)]">{feature.title}</h3>
                  <p className={`${landingMutedTextClass} mt-2 text-sm leading-6`}>{feature.description}</p>
                </LandingReveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className={`${landingSectionClass} overflow-hidden`}>
        <div className={landingContainerClass}>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:items-start">
            <LandingReveal variant="left">
              <p className={landingEyebrowClass}>Use cases</p>
              <h2 className={`${landingTitleClass} mt-3`}>{page.useCaseTitle}</h2>
              <p className={`${landingDescriptionClass} mt-4 max-w-xl`}>{page.useCaseDescription}</p>
            </LandingReveal>
            <div className="space-y-4">
              {page.useCases.map((useCase, index) => {
                const Icon = useCaseIcons[index] ?? CheckCircle2;
                return (
                  <LandingReveal key={useCase.title} delay={100 + index * 80} variant="right" className={`${landingPanelClass} landing-animated-card p-5`}>
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-badge-warning-border)] bg-[color:var(--ui-badge-warning-bg)] text-[color:var(--ui-badge-warning-text)]">
                        <Icon size={17} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-[color:var(--text-primary)]">{useCase.title}</h3>
                        <p className={`${landingMutedTextClass} mt-2 text-sm leading-6`}>{useCase.description}</p>
                      </div>
                    </div>
                  </LandingReveal>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className={`${landingSectionClass} bg-[color:var(--ui-form-muted-surface-bg)]`}>
        <div className={`${landingContainerClass} grid gap-10 lg:grid-cols-[minmax(260px,0.55fr)_minmax(0,1fr)]`}>
          <LandingReveal variant="left">
            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-badge-purple-border)] bg-[color:var(--ui-badge-purple-bg)] text-[color:var(--ui-badge-purple-text)]">
              <CircleHelp size={19} />
            </div>
            <p className={`${landingEyebrowClass} mt-5`}>Frequently asked questions</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-4xl">
              Clear answers before you change the workflow
            </h2>
          </LandingReveal>

          <div className="space-y-3">
            {page.faqs.map((faq, index) => (
              <LandingReveal key={faq.question} delay={60 + index * 55} variant="right">
                <details className={`${landingPanelClass} group p-5`}>
                  <summary className="flex list-none items-center justify-between gap-4 text-base font-semibold text-[color:var(--text-primary)]">
                    {faq.question}
                    <span className="text-xl font-normal text-[color:var(--ui-form-accent)] transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className={`${landingMutedTextClass} mt-4 max-w-3xl text-sm leading-7`}>{faq.answer}</p>
                </details>
              </LandingReveal>
            ))}
          </div>
        </div>
      </section>

      <section id="related-software" className={landingSectionClass}>
        <div className={landingContainerClass}>
          <LandingReveal>
            <p className={landingEyebrowClass}>Related software</p>
            <h2 className={`${landingTitleClass} mt-3`}>Explore the workflows connected to this one</h2>
            <p className={`${landingDescriptionClass} mt-4 max-w-2xl`}>
              Lab Lords connects capacity, students, fees, staff and branches. These pages explain the neighbouring workflows in more detail.
            </p>
          </LandingReveal>

          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {page.relatedSlugs.map((slug, index) => {
              const relatedPage = softwarePages[slug];
              return (
                <LandingReveal key={slug} delay={80 + index * 70}>
                  <Link href={getSoftwarePagePath(slug)} className={`${landingPanelClass} landing-animated-card block h-full p-5`}>
                    <p className={landingEyebrowClass}>Lab Lords software</p>
                    <h3 className="mt-3 text-lg font-semibold text-[color:var(--text-primary)]">{relatedPage.shortName}</h3>
                    <p className={`${landingMutedTextClass} mt-3 line-clamp-3 text-sm leading-6`}>{relatedPage.metaDescription}</p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--ui-form-accent)]">
                      Read the guide
                      <ArrowRight size={14} />
                    </span>
                  </Link>
                </LandingReveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-[color:var(--ui-panel-header-border)] bg-[radial-gradient(circle_at_50%_0%,rgba(6,182,212,0.14),transparent_48%),var(--ui-form-muted-surface-bg)] py-14 sm:py-20">
        <LandingReveal className={`${landingContainerClass} text-center`}>
          <p className={landingEyebrowClass}>Start with real operations</p>
          <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-4xl">
            {page.ctaTitle}
          </h2>
          <p className={`${landingDescriptionClass} mx-auto mt-4 max-w-2xl`}>{page.ctaDescription}</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/sign-up" className={`${landingPrimaryButtonClass} landing-cta-shine`}>
              Start free
              <ArrowRight size={16} />
            </Link>
            <Link href="/support" className={landingSecondaryButtonClass}>
              Contact support
            </Link>
          </div>
        </LandingReveal>
      </section>

      <LandingFooter />
    </main>
  );
}
