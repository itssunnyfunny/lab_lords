import { renderToStaticMarkup } from "react-dom/server";
import Link from "next/link";
import { describe, expect, it } from "vitest";
import { AppButton, appActionClassName } from "@/components/ui/AppButton";
import { AppPanel } from "@/components/ui/AppPanel";
import { FormField } from "@/components/ui/FormField";
import { RecordListPage, RecordListSurface, RecordListState } from "@/components/ui/RecordList";
import { DataTable } from "@/components/tables/DataTable";
import { StudentRecordCard, type StudentRecordCardProps } from "@/app/branch/[branchId]/students/StudentRecordCard";
import { Avatar } from "@/components/ui/Avatar";

describe("shared record presentation contracts", () => {
    it("retains semantic row/column headings, caption and a keyboard scroll region at both densities", () => {
        for (const density of ["compact", "comfortable"] as const) {
            const html = renderToStaticMarkup(<DataTable density={density} caption="Students" data={[{ id: "1", name: "Literal <name>" }]} columns={[{ header: "Student", accessor: "name", rowHeader: true }]} />);
            expect(html).toContain('scope="row"'); expect(html).toContain('scope="col"');
            expect(html).toContain('<caption class="sr-only">Students</caption>');
            expect(html).toContain('role="region"'); expect(html).toContain('tabindex="0"');
            expect(html).toContain('Literal &lt;name&gt;');
        }
    });
    it("keeps controls and overlays independent of the result state", () => {
        const html = renderToStaticMarkup(<RecordListPage title="Students" actions={<button>Add student</button>} overlays={<aside>Overlay slot</aside>}>
            <RecordListSurface busy label="Students" toolbar={<input aria-label="Search" />} footer="Loaded count"><RecordListState kind="loading" title="Loading students" /></RecordListSurface>
        </RecordListPage>);
        expect(html).toContain('aria-busy="true"'); expect(html).toContain('role="status"');
        expect(html).toContain('aria-label="Search"'); expect(html).toContain('Overlay slot');
    });
    it("distinguishes permission restriction from retryable failure", () => {
        const denied = renderToStaticMarkup(<RecordListState kind="restricted" title="Not included in your access" />);
        const failed = renderToStaticMarkup(<RecordListState kind="error" title="Something went wrong" onRetry={() => undefined} />);
        expect(denied).toContain('role="region"'); expect(denied).not.toContain('Try again');
        expect(failed).toContain('role="alert"'); expect(failed).toContain('Try again');
    });
    it("preserves field help/error associations and native invalid/required semantics", () => {
        const html = renderToStaticMarkup(<FormField id="name" label="Full Name" description="Help" error="Required" required><input aria-describedby="caller-help" /></FormField>);
        expect(html).toContain('for="name"'); expect(html).toContain('aria-invalid="true"');
        expect(html).toContain('aria-describedby="caller-help name-description name-error"');
        expect(html).toContain('aria-required="true"');
    });
    it("keeps loading actions disabled and navigation actions as links", () => {
        const html = renderToStaticMarkup(<><AppButton density="compact" isLoading>Saving...</AppButton><Link href="/branch/test/students" className={appActionClassName("primary")}>Students</Link></>);
        expect(html).toContain('disabled=""'); expect(html).toContain('aria-busy="true"');
        expect(html).toMatch(/<a[^>]+href="\/branch\/test\/students"[^>]*>Students<\/a>/);
        expect(html).not.toMatch(/<a[^>]*><button/);
    });
    it("retains the direct body shape needed by specialized dashboard panels", () => {
        const html = renderToStaticMarkup(<AppPanel density="compact" padding="none" aria-labelledby="title"><h2 id="title">Collections</h2></AppPanel>);
        expect(html).toMatch(/<section[^>]+aria-labelledby="title"><h2/);
    });
});

describe("Students card values and interaction boundaries", () => {
    const student: StudentRecordCardProps["student"] = { name: "Literal <student>", phone: null, status: "ACTIVE", monthlyFee: 1400, joinedAt: new Date("2026-09-01T00:00:00+05:30"), seatAllocations: [] };
    const props = { student, canViewPayments: true, onDetails: () => undefined, detailsLabel: "Edit Details" };
    it("distinguishes unknown and restricted finances from a known zero balance", () => {
        const unknown = renderToStaticMarkup(<StudentRecordCard {...props} />);
        const restricted = renderToStaticMarkup(<StudentRecordCard {...props} canViewPayments={false} financials={{ totalDue: 2400, totalPaid: 400, totalWaived: 0 }} />);
        expect(unknown).toContain("Not recorded"); expect(unknown).not.toContain("Due:"); expect(unknown).not.toContain("Paid:");
        expect(restricted).toContain("No payment access"); expect(restricted).not.toContain("2,400"); expect(restricted).not.toContain("Paid:");
        const zero = renderToStaticMarkup(<StudentRecordCard {...props} financials={{ totalDue: 0, totalPaid: 0, totalWaived: 0 }} />);
        expect(zero).toContain("Due:"); expect(zero).toContain("Paid:"); expect(zero).toContain("Monthly fee");
        expect(zero).not.toContain("Payment received"); expect(zero).not.toContain("clean financial record");
        expect(zero).toContain("No phone"); expect(zero).toContain("No seat assigned");
    });
    it("retains every allocation pair, including bundle and component names", () => {
        const allocation = { id: "1", seatId: "seat", shiftId: "shift", multiShiftId: "multi", endDate: null, seat: { id: "seat", label: "A1" }, shift: { id: "shift", name: "Morning", startTime: null, endTime: null }, multiShift: { id: "multi", name: "Full day" } };
        const html = renderToStaticMarkup(<StudentRecordCard {...props} student={{ ...student, seatAllocations: [allocation, { ...allocation, id: "2", shift: { ...allocation.shift, name: "Evening" } }] }} />);
        expect(html).toContain("Full day (Morning)"); expect(html).toContain("Full day (Evening)"); expect(html.match(/<li>/g)).toHaveLength(2);
    });
    it("keeps the name/details and menu separate, with no card-wide action or nested field boxes", () => {
        const html = renderToStaticMarkup(<StudentRecordCard {...props} actions={<button aria-label="Actions">Menu</button>} />);
        expect(html).toMatch(/<article[^>]+data-student-record-card/); expect(html).toContain('aria-label="Edit Details · Literal &lt;student&gt;"');
        expect(html).toContain('aria-label="Actions"'); expect(html).not.toContain("ui-form-muted-surface"); expect(html).not.toContain("grid-cols-2");
        expect(html.match(/<button/g)).toHaveLength(2);
    });
    it("uses quiet initials only when requested, preserving existing avatar consumers", () => {
        const quiet = renderToStaticMarkup(<Avatar name="Aarav Mehta" tone="quiet" />);
        const original = renderToStaticMarkup(<Avatar name="Aarav Mehta" />);
        expect(quiet).toContain("ui-avatar--quiet"); expect(quiet).not.toContain("gradient"); expect(quiet).toContain('aria-hidden="true"');
        expect(original).toContain("bg-gradient-to-br"); expect(original).toContain("radial-gradient");
    });
});
