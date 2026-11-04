import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GuidedImportResults } from "@/app/branch/[branchId]/onboarding/import/[sessionId]/_components/GuidedImportResults";
import type { ImportDetail, Run } from "@/app/branch/[branchId]/onboarding/import/[sessionId]/_components/types";

const noAction = () => {};
const detail = { summary: { readyRows: 0, warningRows: 0, skippedRows: 0 }, guidance: { needsHelp: 1, createdStudents: 1, imported: 0 } } as ImportDetail;
function render(status: string) {
    return renderToStaticMarkup(<GuidedImportResults branchId="branch" detail={detail} run={{ status, totalItems: 3, completedItems: 3, failedItems: 0 } as Run}
        busy={false} onRepair={noAction} onCancel={noAction} onRefresh={noAction} onExport={noAction} />);
}
describe("guided import remaining work", () => {
    it("offers remaining draft work even after the selected records completed successfully", () => {
        expect(render("COMPLETED")).toContain("Finish the remaining work");
        expect(render("COMPLETED")).toContain("Saved progress — a few things still need help");
    });
    it("respects terminal cancellation instead of offering an impossible edit", () => {
        const html = render("CANCELLED");
        expect(html).toContain("Import stopped; saved records are kept");
        expect(html).toContain("this stopped import cannot be edited");
        expect(html).toContain("Back to import history");
        expect(html).not.toContain("Finish the remaining work");
    });
});
