import { CreditCard, Grid3X3, LayoutDashboard, ShieldCheck, Sparkles, Users } from "lucide-react";
import {
  landingContainerClass,
  landingDescriptionClass,
  landingEyebrowClass,
  landingInsetClass,
  landingMutedTextClass,
  landingPanelClass,
  landingSectionClass,
  landingTitleClass,
} from "@/components/ui/landingSurface";

const features = [
  {
    title: "Multi-Branch Management",
    description: "Control all your study halls or libraries from a single, unified dashboard. Compare metrics and manage staff effortlessly.",
    icon: LayoutDashboard,
    tone: "text-[color:var(--ui-badge-cyan-text)] bg-[color:var(--ui-badge-cyan-bg)] border-[color:var(--ui-badge-cyan-border)]",
  },
  {
    title: "Visual Seat Allocation",
    description: "Map out your exact physical layout. Drag and drop students to seats, manage shifts seamlessly, and instantly spot available capacity.",
    icon: Grid3X3,
    tone: "text-[color:var(--ui-badge-purple-text)] bg-[color:var(--ui-badge-purple-bg)] border-[color:var(--ui-badge-purple-border)]",
  },
  {
    title: "Automated Billing & Dues",
    description: "Never lose track of payments again. Detailed ledgers, automated due-date tracking, and single-click payment recording.",
    icon: CreditCard,
    tone: "text-[color:var(--ui-badge-success-text)] bg-[color:var(--ui-badge-success-bg)] border-[color:var(--ui-badge-success-border)]",
  },
  {
    title: "AI-Powered Insights",
    description: "Your silent manager. Get intelligent alerts for expiring memberships, low utilization times, and revenue forecasts.",
    icon: Sparkles,
    tone: "text-[color:var(--ui-badge-warning-text)] bg-[color:var(--ui-badge-warning-bg)] border-[color:var(--ui-badge-warning-border)]",
  },
  {
    title: "Student Profiles & History",
    description: "Maintain comprehensive digital records of every student, their ID proofs, past allocations, and behavior logs.",
    icon: Users,
    tone: "text-[color:var(--ui-badge-cyan-text)] bg-[color:var(--ui-badge-cyan-bg)] border-[color:var(--ui-badge-cyan-border)]",
  },
  {
    title: "Role-Based Access Control",
    description: "Safely delegate tasks to branch managers and staff. Granular permissions ensure your financial data stays private.",
    icon: ShieldCheck,
    tone: "text-[color:var(--ui-badge-danger-text)] bg-[color:var(--ui-badge-danger-bg)] border-[color:var(--ui-badge-danger-border)]",
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className={`${landingSectionClass} bg-[color:var(--ui-form-muted-surface-bg)]`}>
      <div className={landingContainerClass}>
        <div className="mb-10 max-w-3xl md:mb-14">
          <p className={landingEyebrowClass}>Core features</p>
          <h2 className={`${landingTitleClass} mt-3`}>Everything you need to run at scale</h2>
          <p className={`${landingDescriptionClass} mt-4`}>
            We&apos;ve built a specialized toolkit that replaces your registers and spreadsheets with an elegant, lightning-fast application.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(feature => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className={`${landingPanelClass} p-5`}>
                <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-[var(--ui-radius-control)] border ${feature.tone}`}>
                  <Icon size={19} />
                </div>
                <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">{feature.title}</h3>
                <p className={`${landingMutedTextClass} mt-3 text-sm leading-6`}>{feature.description}</p>
                <div className={`${landingInsetClass} mt-5 h-1.5 overflow-hidden`}>
                  <div className="h-full w-2/3 rounded-full bg-[color:var(--ui-tone-info-progress)]" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
