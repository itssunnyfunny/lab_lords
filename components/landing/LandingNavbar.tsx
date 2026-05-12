import Link from "next/link";
import { ArrowRight, LayoutDashboard } from "lucide-react";
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
    <nav className="sticky top-0 z-50 border-b border-[color:var(--ui-panel-header-border)] bg-[color:var(--bg-app)]/85 backdrop-blur-xl">
      <div className={`${landingContainerClass} flex h-16 items-center justify-between gap-4`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] text-[color:var(--ui-badge-cyan-text)]">
            <LayoutDashboard size={18} />
          </div>
          <span className="truncate text-lg font-semibold tracking-tight text-[color:var(--text-primary)]">
            Lab Lords
          </span>
        </div>

        <div className="hidden items-center gap-8 md:flex">
          <Link href="#features" className={landingNavLinkClass}>
            Features
          </Link>
          <Link href="#how-it-works" className={landingNavLinkClass}>
            How it Works
          </Link>
          <Link href="#pricing" className={landingNavLinkClass}>
            Pricing
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="hidden text-sm font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)] sm:inline"
            onClick={onDashboardClick}
          >
            Login
          </button>
          <button type="button" onClick={onDashboardClick} className={`${landingPrimaryButtonClass} h-10 px-3 sm:px-4`}>
            <span className="hidden sm:inline">Go to </span>Dashboard
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </nav>
  );
}
