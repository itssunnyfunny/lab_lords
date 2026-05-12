import { ArrowRight, Building2, CheckCircle2, CreditCard, Grid3X3, MessageSquareText, PlayCircle, Users } from "lucide-react";
import {
  landingContainerClass,
  landingDescriptionClass,
  landingEyebrowClass,
  landingInsetClass,
  landingMetricClass,
  landingPanelClass,
  landingPrimaryButtonClass,
  landingSecondaryButtonClass,
  landingSubtleTextClass,
} from "@/components/ui/landingSurface";

const heroMetrics = [
  { label: "Seat occupancy", value: "84%", detail: "126 of 150 seats", tone: "text-[color:var(--ui-tone-info-text)]", icon: Grid3X3 },
  { label: "Active students", value: "248", detail: "18 morning shift", tone: "text-[color:var(--ui-tone-success-text)]", icon: Users },
  { label: "Fees collected", value: "Rs.1.42L", detail: "Rs.37k due", tone: "text-[color:var(--text-primary)]", icon: CreditCard },
];

const commandItems = [
  { label: "Dashboard", active: true },
  { label: "Seat map" },
  { label: "Payments" },
  { label: "Messages" },
];

const seatRows = [
  ["A1", "A2", "A3", "A4", "A5", "A6"],
  ["B1", "B2", "B3", "B4", "B5", "B6"],
  ["C1", "C2", "C3", "C4", "C5", "C6"],
  ["D1", "D2", "D3", "D4", "D5", "D6"],
];

const paymentRows = [
  { name: "Rahul Mehta", amount: "Rs.1,200", status: "Due", tone: "text-[color:var(--ui-tone-danger-text)]" },
  { name: "Priya Patel", amount: "Rs.2,500", status: "Paid", tone: "text-[color:var(--ui-tone-success-text)]" },
];

export function LandingHero({
  onDashboardClick,
}: {
  onDashboardClick: () => void;
}) {
  return (
    <section className="relative z-10">
      <div className={`${landingContainerClass} grid gap-8 pt-14 sm:pt-16 md:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.78fr)] md:items-center md:gap-10 md:pt-20`}>
        <div className="max-w-3xl text-left">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] px-3 py-1.5 text-[color:var(--ui-badge-cyan-text)]">
            <Building2 size={14} />
            <span className={landingEyebrowClass}>Seats, fees, shifts, and follow-ups</span>
          </div>

          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-5xl lg:text-7xl">
            The Operating System for Offline Education.
          </h1>

          <p className={`${landingDescriptionClass} mt-5 max-w-2xl text-base sm:text-lg`}>
            Lab Lords brings seat allocation, student records, shift planning, fee collection, and AI follow-ups into one branch dashboard built for coaching centers and study libraries.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={onDashboardClick} className={landingPrimaryButtonClass}>
              Start Free Trial
              <ArrowRight size={16} />
            </button>
            <button type="button" onClick={onDashboardClick} className={landingSecondaryButtonClass}>
              <PlayCircle size={16} />
              View Live Demo
            </button>
          </div>
        </div>

        <div className={`${landingPanelClass} overflow-hidden`}>
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--ui-panel-header-border)] bg-[color:var(--ui-form-muted-surface-bg)] px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] text-[color:var(--ui-badge-cyan-text)]">
                <Building2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Lab Lords Branch OS</p>
                <h2 className="mt-1 truncate text-base font-semibold text-[color:var(--text-primary)]">Downtown Branch</h2>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-[color:var(--ui-badge-success-border)] bg-[color:var(--ui-badge-success-bg)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--ui-badge-success-text)]">
              Live
            </span>
          </div>

          <div className="grid bg-[color:var(--bg-app)] lg:grid-cols-[118px_minmax(0,1fr)]">
            <nav className="hidden border-r border-[color:var(--ui-panel-header-border)] bg-[color:var(--ui-form-muted-surface-bg)] p-3 lg:block">
              <div className="space-y-1.5">
                {commandItems.map(item => (
                  <div
                    key={item.label}
                    className={`rounded-[var(--ui-radius-control)] px-3 py-2 text-xs font-semibold ${
                      item.active
                        ? "border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] text-[color:var(--ui-badge-cyan-text)]"
                        : "text-[color:var(--text-secondary)]"
                    }`}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            </nav>

            <div className="space-y-4 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between md:flex-col lg:flex-row">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Today in branch</p>
                  <h3 className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">Morning shift operations</h3>
                </div>
                <div className="flex w-max items-center gap-2 rounded-full border border-[color:var(--ui-badge-success-border)] bg-[color:var(--ui-badge-success-bg)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ui-badge-success-text)]">
                  <CheckCircle2 size={13} />
                  9:00 AM shift active
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:grid-cols-1 xl:grid-cols-3">
                {heroMetrics.map(metric => {
                  const Icon = metric.icon;
                  return (
                    <div key={metric.label} className={landingMetricClass}>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`${landingSubtleTextClass} truncate text-[11px]`}>{metric.label}</p>
                        <Icon size={13} className="shrink-0 text-[color:var(--text-muted)]" />
                      </div>
                      <p className={`mt-2 text-lg font-semibold tracking-tight ${metric.tone}`}>{metric.value}</p>
                      <p className={`${landingSubtleTextClass} mt-1 truncate text-[11px]`}>{metric.detail}</p>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_180px]">
                <div className={landingInsetClass + " p-3"}>
                  <div className="mb-3 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">Seat map</p>
                      <span className="shrink-0 text-xs font-medium text-[color:var(--ui-tone-info-text)]">24 free</span>
                    </div>
                    <p className={`${landingSubtleTextClass} text-xs`}>Morning shift allocation and availability.</p>
                  </div>

                  <div className="space-y-2">
                    {seatRows.map(row => (
                      <div key={row[0]} className="grid grid-cols-6 gap-2">
                        {row.map(label => {
                          const selected = ["B3", "B4", "D2"].includes(label);
                          const occupied = ["A2", "A5", "B1", "C4", "C6", "D5"].includes(label);
                          return (
                            <div
                              key={label}
                              className={`flex h-8 items-center justify-center rounded-[var(--ui-radius-control)] border text-[10px] font-semibold ${
                                selected
                                  ? "border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] text-[color:var(--ui-badge-cyan-text)]"
                                  : occupied
                                    ? "border-[color:var(--ui-badge-danger-border)] bg-[color:var(--ui-badge-danger-bg)] text-[color:var(--ui-badge-danger-text)]"
                                    : "border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-surface-bg)] text-[color:var(--text-secondary)]"
                              }`}
                            >
                              {label}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className={landingInsetClass + " p-3"}>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">Fee queue</p>
                      <CreditCard size={14} className="text-[color:var(--text-muted)]" />
                    </div>
                    <div className="space-y-2">
                      {paymentRows.map(row => (
                        <div key={row.name} className="rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-surface-bg)] px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-medium text-[color:var(--text-primary)]">{row.name}</p>
                            <p className={`text-xs font-semibold ${row.tone}`}>{row.status}</p>
                          </div>
                          <p className={`${landingSubtleTextClass} mt-1 text-xs`}>{row.amount}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={landingInsetClass + " p-3"}>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">AI follow-up</p>
                      <MessageSquareText size={14} className="text-[color:var(--text-muted)]" />
                    </div>
                    <p className="text-xl font-semibold text-[color:var(--ui-tone-warning-text)]">5 drafts</p>
                    <p className={`${landingSubtleTextClass} mt-1 text-xs`}>Ready for overdue students.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[var(--ui-radius-control)] border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-badge-cyan-text)]">Recommended next action</p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">Allocate seat B3 to Priya Sharma and send the fee confirmation.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
