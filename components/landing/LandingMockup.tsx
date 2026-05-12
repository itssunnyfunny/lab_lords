import { Activity, AlertTriangle, CalendarClock, CreditCard, Grid3X3, LayoutDashboard, MessageSquareText, Users } from "lucide-react";
import {
  landingContainerClass,
  landingInsetClass,
  landingMutedTextClass,
  landingPanelClass,
  landingSubtleTextClass,
} from "@/components/ui/landingSurface";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Students", icon: Users },
  { label: "Seat Map", icon: Grid3X3 },
  { label: "Allocations", icon: CalendarClock },
  { label: "Payments", icon: CreditCard },
  { label: "Overdue", icon: AlertTriangle },
];

const stats = [
  { label: "Seat Utilization", value: "85.4%", detail: "128 / 150 booked", tone: "text-[color:var(--ui-tone-info-text)]" },
  { label: "Active Students", value: "248", detail: "12 joined this week", tone: "text-[color:var(--ui-tone-success-text)]" },
  { label: "Monthly Revenue", value: "Rs.1.42L", detail: "Rs.37k still due", tone: "text-[color:var(--text-primary)]" },
];

const activity = [
  { title: "Seat A12 Allocated", detail: "Aarav Sharma newly enrolled.", tone: "bg-[color:var(--ui-badge-cyan-bg)] text-[color:var(--ui-badge-cyan-text)]" },
  { title: "Payment Received", detail: "Rs.2,500 from Priya Patel.", tone: "bg-[color:var(--ui-badge-success-bg)] text-[color:var(--ui-badge-success-text)]" },
  { title: "Overdue Alert", detail: "5 students exceeded 7 days limit.", tone: "bg-[color:var(--ui-badge-warning-bg)] text-[color:var(--ui-badge-warning-text)]" },
];

const collectionRows = [
  { student: "Priya Patel", amount: "Rs.2,500", status: "Paid", tone: "text-[color:var(--ui-tone-success-text)]" },
  { student: "Rahul Mehta", amount: "Rs.1,200", status: "Due", tone: "text-[color:var(--ui-tone-danger-text)]" },
  { student: "Sneha Rao", amount: "Rs.1,800", status: "Pending", tone: "text-[color:var(--ui-tone-warning-text)]" },
];

export function LandingMockup() {
  return (
    <section className={`${landingContainerClass} relative z-10 pb-16 pt-10 sm:pb-20 md:pb-24`}>
      <div className={`${landingPanelClass} overflow-hidden`}>
        <div className="flex h-11 items-center gap-2 border-b border-[color:var(--ui-panel-header-border)] bg-[color:var(--ui-form-muted-surface-bg)] px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--ui-tone-danger-progress)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--ui-tone-warning-progress)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--ui-tone-success-progress)]" />
          <div className="ml-3 hidden h-7 min-w-0 flex-1 items-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-input-bg)] px-3 text-xs text-[color:var(--text-muted)] sm:flex">
            Lab Lords OS
          </div>
        </div>

        <div className="grid min-h-[560px] grid-cols-1 bg-[color:var(--bg-app)] md:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden border-r border-[color:var(--ui-panel-header-border)] bg-[color:var(--ui-form-muted-surface-bg)] p-4 md:block">
            <div className={`${landingInsetClass} mb-6 p-3`}>
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">Downtown Branch</p>
              <p className={`${landingSubtleTextClass} mt-1 text-xs`}>Premium Plan</p>
            </div>

            <nav className="space-y-1.5">
              {navItems.map(item => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className={`flex items-center gap-3 rounded-[var(--ui-radius-control)] px-3 py-2.5 text-sm font-medium ${
                      item.active
                        ? "border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] text-[color:var(--ui-badge-cyan-text)]"
                        : "text-[color:var(--text-secondary)]"
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </div>
                );
              })}
            </nav>
          </aside>

          <div className="p-4 sm:p-5 md:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--text-muted)]">Branch dashboard</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--text-primary)]">Branch Overview</h2>
                <p className={`${landingSubtleTextClass} mt-1 text-sm`}>Live metrics from your facility.</p>
              </div>
              <div className={`${landingInsetClass} flex w-max items-center gap-2 px-3 py-2 text-xs text-[color:var(--ui-tone-success-text)]`}>
                <span className="h-2 w-2 rounded-full bg-[color:var(--ui-tone-success-progress)]" />
                Live operations
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {stats.map(stat => (
                <div key={stat.label} className={`${landingInsetClass} p-4`}>
                  <p className={`${landingMutedTextClass} text-sm`}>{stat.label}</p>
                  <p className={`mt-2 text-3xl font-semibold tracking-tight ${stat.tone}`}>{stat.value}</p>
                  <p className={`${landingSubtleTextClass} mt-1 text-xs`}>{stat.detail}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className={`${landingInsetClass} min-h-[250px] p-4`}>
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">Allocation board</h3>
                    <p className={`${landingSubtleTextClass} mt-1 text-xs`}>Shift-aware availability with current bookings</p>
                  </div>
                  <CalendarClock size={16} className="text-[color:var(--text-muted)]" />
                </div>

                <div className="grid grid-cols-8 gap-2">
                  {Array.from({ length: 40 }).map((_, index) => {
                    const occupied = [1, 3, 6, 9, 12, 18, 21, 24, 29, 34].includes(index);
                    const selected = [14, 15, 16].includes(index);
                    return (
                      <div
                        key={index}
                        className={`aspect-square rounded-[var(--ui-radius-control)] border ${
                          selected
                            ? "border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)]"
                            : occupied
                              ? "border-[color:var(--ui-badge-danger-border)] bg-[color:var(--ui-badge-danger-bg)]"
                              : "border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-surface-bg)]"
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className={`${landingInsetClass} p-4`}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">Collection tracker</h3>
                    <CreditCard size={15} className="text-[color:var(--text-muted)]" />
                  </div>
                  <div className="mt-4 space-y-2">
                    {collectionRows.map(row => (
                      <div key={row.student} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-surface-bg)] px-3 py-2">
                        <p className="truncate text-xs font-medium text-[color:var(--text-primary)]">{row.student}</p>
                        <p className="text-xs text-[color:var(--text-secondary)]">{row.amount}</p>
                        <p className={`text-xs font-semibold ${row.tone}`}>{row.status}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`${landingInsetClass} p-4`}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">AI follow-up queue</h3>
                    <MessageSquareText size={15} className="text-[color:var(--text-muted)]" />
                  </div>
                  <div className="mt-4 space-y-3">
                    {activity.map(item => (
                      <div key={item.title} className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] ${item.tone}`}>
                          <Activity size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[color:var(--text-primary)]">{item.title}</p>
                          <p className={`${landingSubtleTextClass} mt-0.5 text-xs`}>{item.detail}</p>
                        </div>
                      </div>
                    ))}
                    <div className="rounded-[var(--ui-radius-control)] border border-[color:var(--ui-badge-warning-border)] bg-[color:var(--ui-badge-warning-bg)] px-3 py-2 text-xs leading-5 text-[color:var(--ui-badge-warning-text)]">
                      5 overdue students have message drafts ready for review.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
