import { BrainCircuit, CreditCard, Database, Grid3X3, KeyRound, Network, ShieldCheck, Users } from "lucide-react";
import {
  landingContainerClass,
  landingDescriptionClass,
  landingEyebrowClass,
  landingMutedTextClass,
  landingPanelClass,
  landingSectionClass,
  landingTitleClass,
} from "@/components/ui/landingSurface";
import { LandingReveal } from "@/components/landing/LandingReveal";

const features = [
  {
    title: "A real allocation engine, not a colored grid",
    description:
      "Map physical seats once, then assign students by shift with overlap checks that block impossible bookings before they create front-desk confusion.",
    icon: Grid3X3,
    tone: "text-[color:var(--ui-badge-cyan-text)] bg-[color:var(--ui-badge-cyan-bg)] border-[color:var(--ui-badge-cyan-border)]",
    layout: "lg:col-span-2",
  },
  {
    title: "Branch-safe data",
    description:
      "Students, seats, payments, staff, and AI outputs stay scoped to the right branch so operators can expand without leaking context.",
    icon: ShieldCheck,
    tone: "text-[color:var(--ui-badge-success-text)] bg-[color:var(--ui-badge-success-bg)] border-[color:var(--ui-badge-success-border)]",
    layout: "",
  },
  {
    title: "Payment memory",
    description:
      "Track paid, due, waived, and pending balances against the student record instead of chasing notes across registers and chats.",
    icon: CreditCard,
    tone: "text-[color:var(--ui-badge-warning-text)] bg-[color:var(--ui-badge-warning-bg)] border-[color:var(--ui-badge-warning-border)]",
    layout: "",
  },
  {
    title: "Owner-approved AI",
    description:
      "The system can draft overdue messages and branch health reports, but it never acts on its own. Your team reviews before anything leaves the app.",
    icon: BrainCircuit,
    tone: "text-[color:var(--ui-badge-purple-text)] bg-[color:var(--ui-badge-purple-bg)] border-[color:var(--ui-badge-purple-border)]",
    layout: "",
  },
  {
    title: "Staff permissions that match the floor",
    description:
      "Managers and staff can be given operational access without exposing owner-level finance and configuration decisions.",
    icon: KeyRound,
    tone: "text-[color:var(--ui-badge-danger-text)] bg-[color:var(--ui-badge-danger-bg)] border-[color:var(--ui-badge-danger-border)]",
    layout: "",
  },
  {
    title: "Records built for migration",
    description:
      "Student profiles, branch settings, shifts, seats, and audit history are structured for the moment your business outgrows notebooks.",
    icon: Database,
    tone: "text-[color:var(--ui-badge-cyan-text)] bg-[color:var(--ui-badge-cyan-bg)] border-[color:var(--ui-badge-cyan-border)]",
    layout: "",
  },
];

const operatorOutcomes = [
  { label: "Front desk", value: "knows who sits where", icon: Users },
  { label: "Managers", value: "act inside their permission lane", icon: KeyRound },
  { label: "Owners", value: "see branch health without waiting", icon: Network },
];

export function LandingFeatures() {
  return (
    <section id="features" className={`${landingSectionClass} overflow-hidden bg-[color:var(--ui-form-muted-surface-bg)]`}>
      <span className="landing-section-glow left-[4%] top-20 h-52 w-52 bg-emerald-400/10 [animation-delay:1.2s]" aria-hidden="true" />
      <div className={`${landingContainerClass} relative`}>
        <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(280px,0.5fr)] lg:items-end">
          <LandingReveal variant="left">
            <p className={landingEyebrowClass}>What becomes calmer</p>
            <h2 className={`${landingTitleClass} mt-3`}>Purpose-built controls for branches that run on physical capacity.</h2>
            <p className={`${landingDescriptionClass} mt-4 max-w-2xl`}>
              Every surface is tuned for offline education operators: seat inventory, shift timing, fee discipline, delegated staff work, and reviewable AI support.
            </p>
          </LandingReveal>

          <div className="grid grid-cols-1 gap-2">
            {operatorOutcomes.map(outcome => {
              const Icon = outcome.icon;
              return (
                <LandingReveal key={outcome.label} delay={120} variant="right" className="landing-animated-card flex items-center gap-3 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-surface-bg)] px-3 py-2.5">
                  <Icon size={15} className="shrink-0 text-[color:var(--ui-tone-info-text)]" />
                  <p className="min-w-0 text-sm text-[color:var(--text-secondary)]">
                    <span className="font-semibold text-[color:var(--text-primary)]">{outcome.label}</span> {outcome.value}
                  </p>
                </LandingReveal>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <LandingReveal key={feature.title} delay={80 + index * 70} variant="up" className={`${landingPanelClass} landing-animated-card ${feature.layout} p-5`}>
                <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-[var(--ui-radius-control)] border ${feature.tone}`}>
                  <Icon size={19} />
                </div>
                <h3 className="max-w-xl text-lg font-semibold text-[color:var(--text-primary)]">{feature.title}</h3>
                <p className={`${landingMutedTextClass} mt-3 max-w-2xl text-sm leading-6`}>{feature.description}</p>
              </LandingReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
