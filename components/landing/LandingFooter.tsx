import { LayoutDashboard } from "lucide-react";
import {
  landingContainerClass,
  landingMutedTextClass,
  landingNavLinkClass,
  landingSubtleTextClass,
} from "@/components/ui/landingSurface";

export function LandingFooter() {
  return (
    <footer className="relative z-10 border-t border-[color:var(--ui-panel-header-border)] bg-[color:var(--bg-app)] py-10">
      <div className={landingContainerClass}>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="max-w-md">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] text-[color:var(--ui-badge-cyan-text)]">
                <LayoutDashboard size={18} />
              </div>
              <span className="text-lg font-semibold tracking-tight text-[color:var(--text-primary)]">Lab Lords</span>
            </div>
            <p className={`${landingMutedTextClass} text-sm leading-6`}>
              The premium operating system designed specifically for offline study halls, libraries, and coaching centers.
            </p>
          </div>

          <div className="md:min-w-56">
            <h4 className="mb-4 font-semibold text-[color:var(--text-primary)]">Product</h4>
            <ul className="space-y-3">
              <li><a href="#features" className={landingNavLinkClass}>Features</a></li>
              <li><a href="#how-it-works" className={landingNavLinkClass}>How it Works</a></li>
              <li><a href="#pricing" className={landingNavLinkClass}>Pricing</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-[color:var(--ui-panel-header-border)] pt-6 text-sm md:flex-row md:items-center md:justify-between">
          <p className={landingSubtleTextClass}>
            &copy; {new Date().getFullYear()} Lab Lords. All rights reserved.
          </p>
          <p className={landingSubtleTextClass}>Built with precision for education operators.</p>
        </div>
      </div>
    </footer>
  );
}
