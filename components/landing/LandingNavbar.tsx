import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import {
  landingContainerClass,
  landingNavLinkClass,
  landingPrimaryButtonClass,
} from "@/components/ui/landingSurface";

export function LandingNavbar({
  onDashboardClick,
}: {
  onDashboardClick: () => void;
}) {
  return (
    <nav className="sticky top-0 z-50 border-b border-[color:var(--ui-panel-header-border)] bg-[color:var(--bg-app)]/88 backdrop-blur-xl">
      <div className={`${landingContainerClass} flex h-16 items-center justify-between gap-4`}>
        <div className="landing-reveal flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] text-[color:var(--ui-badge-cyan-text)]">
            <Building2 size={18} />
          </div>
          <div className="min-w-0">
            <span className="block truncate text-base font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-lg">
              Lab Lords
            </span>
            <span className="hidden truncate text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)] sm:block">
              Branch OS
            </span>
          </div>
        </div>

        <div className="landing-reveal hidden items-center gap-8 [animation-delay:120ms] md:flex">
          <Link href="#platform" className={landingNavLinkClass}>
            Platform
          </Link>
          <Link href="#workflow" className={landingNavLinkClass}>
            Workflow
          </Link>
          <Link href="#pricing" className={landingNavLinkClass}>
            Pricing
          </Link>
        </div>

        <div className="landing-reveal flex shrink-0 items-center gap-2 [animation-delay:220ms]">
          <button
            type="button"
            className="hidden text-sm font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)] sm:inline"
            onClick={onDashboardClick}
          >
            Sign in
          </button>
          <button type="button" onClick={onDashboardClick} className={`${landingPrimaryButtonClass} landing-cta-shine h-10 px-3 sm:px-4`}>
            <span className="hidden sm:inline">Open workspace</span>
            <span className="sm:hidden">Open</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </nav>
  );
}
