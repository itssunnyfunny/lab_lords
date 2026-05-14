import { Building2 } from "lucide-react";
import {
  landingContainerClass,
  landingMutedTextClass,
  landingNavLinkClass,
  landingSubtleTextClass,
} from "@/components/ui/landingSurface";
import { LandingReveal } from "@/components/landing/LandingReveal";

export function LandingFooter() {
  return (
    <footer className="relative z-10 overflow-hidden border-t border-[color:var(--ui-panel-header-border)] bg-[color:var(--bg-app)] py-10">
      <span className="landing-section-glow bottom-0 right-[20%] h-40 w-40 bg-cyan-400/10 [animation-delay:2s]" aria-hidden="true" />
      <div className={`${landingContainerClass} relative`}>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <LandingReveal variant="left" className="max-w-md">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] text-[color:var(--ui-badge-cyan-text)]">
                <Building2 size={18} />
              </div>
              <div>
                <span className="block text-lg font-semibold tracking-tight text-[color:var(--text-primary)]">Lab Lords</span>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Branch OS</span>
              </div>
            </div>
            <p className={`${landingMutedTextClass} text-sm leading-6`}>
              A micro-ERP for offline education businesses that need disciplined branch operations before they need another spreadsheet.
            </p>
          </LandingReveal>

          <LandingReveal delay={100} variant="up" className="md:min-w-44">
            <h4 className="mb-4 font-semibold text-[color:var(--text-primary)]">Product</h4>
            <ul className="space-y-3">
              <li><a href="#platform" className={landingNavLinkClass}>Platform</a></li>
              <li><a href="#features" className={landingNavLinkClass}>Capabilities</a></li>
              <li><a href="#workflow" className={landingNavLinkClass}>Workflow</a></li>
            </ul>
          </LandingReveal>

          <LandingReveal delay={180} variant="up" className="md:min-w-44">
            <h4 className="mb-4 font-semibold text-[color:var(--text-primary)]">Business</h4>
            <ul className="space-y-3">
              <li><a href="#pricing" className={landingNavLinkClass}>Pricing</a></li>
              <li><a href="#platform" className={landingNavLinkClass}>Branch control</a></li>
              <li><a href="#features" className={landingNavLinkClass}>AI review</a></li>
            </ul>
          </LandingReveal>
        </div>

        <LandingReveal delay={240} className="mt-8 flex flex-col gap-2 border-t border-[color:var(--ui-panel-header-border)] pt-6 text-sm md:flex-row md:items-center md:justify-between">
          <p className={landingSubtleTextClass}>
            &copy; {new Date().getFullYear()} Lab Lords. All rights reserved.
          </p>
          <p className={landingSubtleTextClass}>Built with precision for education operators.</p>
        </LandingReveal>
      </div>
    </footer>
  );
}
