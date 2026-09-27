import { renderToStaticMarkup } from "react-dom/server";
import Link from "next/link";
import { describe, expect, it } from "vitest";
import { AppButton, appActionClassName } from "@/components/ui/AppButton";
import { AppPanel } from "@/components/ui/AppPanel";
import { FormField } from "@/components/ui/FormField";
import { RecordListPage, RecordListSurface, RecordListState } from "@/components/ui/RecordList";
import { DataTable } from "@/components/tables/DataTable";

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
