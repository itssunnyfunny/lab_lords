import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReferenceSeating } from "@/components/dashboard/ReferenceSeating";
import { ReferenceCollections } from "@/components/dashboard/ReferenceCollections";
import { DashboardWorklists } from "@/components/dashboard/ReferenceWorklists";
import { ActivityLink } from "@/components/dashboard/ActivityLink";
import { UserPreferencesProvider } from "@/components/settings/UserPreferencesApplier";
import type { DashboardOverview } from "@/lib/dashboardContracts";

describe("reference dashboard accessible and permission-aware composition", () => {
    it("gives the selected seating tab the only tab stop, preserving named panel semantics", () => {
        const source = { status: "restricted" as const, data: null };
        const html = renderToStaticMarkup(<ReferenceSeating seating={source} attendance={source} base="/branch/test" retry={() => undefined} />);
        expect(html.match(/role="tab"/g)).toHaveLength(3);
        expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
        expect(html.match(/tabindex="-1"/g)).toHaveLength(2);
        expect(html).toContain('role="tabpanel"');
        expect(html).not.toContain('href="/branch/test/seats"');
        expect(html).not.toContain('href="/branch/test/attendance"');
    });
    it("keeps missing historical cells distinct from real zero occupancy", () => {
        const seating: DashboardOverview["seating"] = { status: "success", data: { seats: 10, shifts: 1, capacity: 10, occupied: 0, physicalSeatsInUse: 0, utilizationPercent: 0, threshold: 35, lowUtilization: true, coverageStartedAt: null, days: ["2026-09-26", "2026-09-27"], seatsPreview: [], rows: [{ id: "shift", name: "Morning", startTime: "06:00", endTime: "12:00", cells: [{ date: "2026-09-26", capacity: null, occupied: null, recordedAt: null }, { date: "2026-09-27", capacity: 10, occupied: 0, recordedAt: null }] }] } };
        const html = renderToStaticMarkup(<ReferenceSeating seating={seating} attendance={{ status: "restricted", data: null }} base="/branch/test" retry={() => undefined} />);
        expect(html).toContain('data-fill="unknown"'); expect(html).toContain('data-fill="empty"');
        expect(html).toContain("No recorded observation"); expect(html).toContain("0 of 10 shift slots");
    });
    it("states the cohort rate denominator including waivers and gives the chart a data table", () => {
        const html = renderToStaticMarkup(<ReferenceCollections branchId="test" retry={() => undefined} source={{ status: "success", data: { month: "2026-09", billed: 1000, collected: 400, pending: 400, waived: 200, rate: 50, points: [{ date: "2026-09-01", billed: 1000, collected: 400, pending: 400, collectionRate: 50 }] } }} />);
        expect(html).toContain("collected ÷ (billed − waived)"); expect(html).toContain("50%"); expect(html).toContain("<table>");
    });
    it("keeps a 31-day collection axis readable without dropping daily bars or table values", () => {
        const points = Array.from({ length: 31 }, (_, index) => ({
            date: `2026-10-${String(index + 1).padStart(2, "0")}`,
            billed: 100, collected: 40, pending: 60, collectionRate: 40,
        }));
        const html = renderToStaticMarkup(<UserPreferencesProvider signedIn={false}><ReferenceCollections branchId="test" retry={() => undefined} source={{ status: "success", data: { month: "2026-10", billed: 3100, collected: 1240, pending: 1860, waived: 0, rate: 40, points } }} /></UserPreferencesProvider>);
        const chart = html.match(/<svg class="rd-chart"[^>]*>([\s\S]*?)<\/svg>/)![1];
        const ticks = [...chart.matchAll(/<text x="([^"]+)" y="173"[^>]*>([^<]+)<\/text>/g)]
            .map(([, x, label]) => ({ x: Number(x), label }));
        expect(ticks[0].label).toBe("1 Oct");
        expect(ticks.at(-1)!.label).toBe("31 Oct");
        for (let index = 1; index < ticks.length; index++) {
            expect(ticks[index].x - ticks[index - 1].x).toBeGreaterThan(40);
        }
        expect(chart.match(/<rect /g)).toHaveLength(62);
        const table = html.match(/<tbody>([\s\S]*?)<\/tbody>/)![1];
        expect(table.match(/<tr>/g)).toHaveLength(31);
        expect(table).toContain("2026-10-30");
        expect(table).toContain("2026-10-31");
    });
    it("does not link restricted worklist titles into forbidden destinations", () => {
        const data = { terms: { status: "restricted", data: null }, followUps: { status: "restricted", data: null } } as DashboardOverview;
        const html = renderToStaticMarkup(<DashboardWorklists data={data} base="/branch/test" retry={() => undefined} />);
        expect(html).not.toContain('href="/branch/test/follow-ups"'); expect(html).not.toContain('href="/branch/test/dashboard-settings');
    });
    it("renders attendance activity with an ordinary anchor for document navigation", () => {
        const result = ActivityLink({ href: "/branch/test/attendance", children: "Attendance" });
        expect(result.type).toBe("a"); expect(result.props.href).toBe("/branch/test/attendance");
    });
});
