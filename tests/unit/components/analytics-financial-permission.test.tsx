import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { KpiRow } from "@/components/snapshot/KpiRow";
import { SideStats } from "@/components/snapshot/SideStats";
import { SnapshotFooter } from "@/components/snapshot/SnapshotFooter";
import type { BranchSnapshot } from "@/lib/api/analytics";

vi.mock("@/components/settings/LocalizedText", () => ({
  useTranslation: () => Object.assign((text: string) => text, { owned: (text: string) => text }),
}));
vi.mock("@/components/settings/UserPreferencesApplier", () => ({
  useUserPreferences: () => ({
    formatNumber: (value: number) => String(value),
    formatDate: (value: string) => value,
  }),
}));
vi.mock("recharts", () => {
  const Empty = () => null;
  return {
    ResponsiveContainer: Empty, AreaChart: Empty, Area: Empty, linearGradient: Empty,
    BarChart: Empty, Bar: Empty, Tooltip: Empty, XAxis: Empty, YAxis: Empty,
  };
});

const base = {
  totalStudents: 5,
  activeStudents: 4,
  assignedSeats: 3,
  totalSeats: 10,
  occupancyRate: 30,
};

describe("financial analytics component presentation", () => {
  it("keeps operational cards while hiding every finance card under payment denial", () => {
    const snapshot: BranchSnapshot = { ...base, financialAccess: false };
    const html = renderToStaticMarkup(<>
      <KpiRow snapshot={snapshot} branchId="branch" />
      <SideStats snapshot={snapshot} />
      <SnapshotFooter snapshot={snapshot} branchId="branch" />
    </>);
    expect(html).toContain("Active Students");
    expect(html).toContain("Total Utilization");
    expect(html).toContain("Active vs. Inactive Students");
    for (const label of ["Collected Revenue", "Due Payments", "Revenue Summary", "Due vs. Paid Payments", "Billable Revenue"]) {
      expect(html).not.toContain(label);
    }
  });

  it("retains the authorized financial cards", () => {
    const snapshot: BranchSnapshot = {
      ...base, financialAccess: true,
      monthlyRevenue: 901, dueAmount: 101, paidAmount: 800, collectionRate: 89,
    };
    const html = renderToStaticMarkup(<>
      <KpiRow snapshot={snapshot} branchId="branch" />
      <SideStats snapshot={snapshot} />
      <SnapshotFooter snapshot={snapshot} branchId="branch" />
    </>);
    expect(html).toContain("Collected Revenue");
    expect(html).toContain("Due Payments");
    expect(html).toContain("Revenue Summary");
    expect(html).toContain("Due vs. Paid Payments");
  });
});
