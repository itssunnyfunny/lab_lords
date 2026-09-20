import { MarketingShell } from "@/components/landing/MarketingShell";
import { siteConfig } from "@/lib/site";

export type LegalSection = {
  title: string;
  body?: string;
  items?: string[];
};

type LegalPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  updatedAt?: string;
  sections: LegalSection[];
  children?: React.ReactNode;
};

export function LegalPage({
  eyebrow,
  title,
  description,
  updatedAt,
  sections,
  children,
}: LegalPageProps) {
  return (
    <MarketingShell>
      <div className="public-reference-page public-legal">
      <article className="marketing-container public-legal-document py-12 sm:py-16">
        <header className="public-legal-header mx-auto max-w-3xl">
          <p className="marketing-eyebrow">{eyebrow}</p>
          <h1 className="marketing-title mt-4">{title}</h1>
          <p className="mt-5 text-base leading-8 text-[color:var(--text-secondary)]">{description}</p>
          {updatedAt && (
            <p className="mt-4 text-sm text-[color:var(--text-muted)]">Last updated: {updatedAt}</p>
          )}
        </header>

        <div className="public-legal-sections mx-auto mt-10 max-w-3xl divide-y divide-[color:var(--ui-panel-header-border)]">
          {sections.map(section => (
            <section key={section.title} className="py-8">
              <h2 className="text-xl font-semibold tracking-tight text-[color:var(--text-primary)]">
                {section.title}
              </h2>
              {section.body && (
                <p className="mt-3 text-base leading-8 text-[color:var(--text-secondary)]">
                  {section.body}
                </p>
              )}
              {section.items && (
                <ul className="mt-4 list-disc space-y-3 pl-5">
                  {section.items.map(item => (
                    <li key={item} className="text-base leading-8 text-[color:var(--text-secondary)]">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {children && <div className="mx-auto mt-4 max-w-3xl">{children}</div>}

        <footer className="mx-auto mt-12 max-w-3xl border-t border-[color:var(--ui-panel-header-border)] pt-6 text-base leading-8 text-[color:var(--text-muted)]">
          Questions? Contact <a className="text-[color:var(--ui-form-accent)] hover:text-[color:var(--ui-form-accent-hover)]" href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a>.
        </footer>
      </article>
      </div>
    </MarketingShell>
  );
}
