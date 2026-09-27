import { useState } from "react";
import { Users, Pencil, PowerOff } from "lucide-react";
import { AppButton, AppPanel, AppSelect, Dialog, FormField } from "@/components/ui";
import { RecordListPage, RecordListSurface, RecordListState } from "@/components/ui/RecordList";
import { Badge } from "@/components/ui/Badge";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { DataTable, type DataViewMode } from "@/components/tables/DataTable";
import { ViewToggle } from "@/components/tables/ViewToggle";
import { useTranslation } from "@/components/settings/LocalizedText";
import { formControlClass } from "@/components/ui/formSurface";

/** A development-only consumer, not a component replica or an application route. */
export function ComponentGallery() {
    const t = useTranslation();
    const [view, setView] = useState<DataViewMode>("table");
    const [state, setState] = useState("ready");
    const [density, setDensity] = useState<"compact" | "comfortable">("compact");
    const [query, setQuery] = useState("");
    const [dialog, setDialog] = useState(false);
    const [nested, setNested] = useState(false);
    const [draft, setDraft] = useState("");
    const [invalid, setInvalid] = useState(false);
    const rows = [{ id: "gallery-1", name: "Aarav Mehta", status: "Active" }, { id: "gallery-2", name: "Nisha Verma", status: "Active" }, { id: "gallery-3", name: "सिंथेटिक छात्रा आराध्या शर्मा दीर्घ नाम", status: "Inactive" }].filter(row => row.name.toLowerCase().includes(query.toLowerCase()));
    return <RecordListPage title="Shared component gallery" eyebrow="Local development only" description="Imports the production components and record pattern. Change language in the application bar; this fixture never reaches a database or provider."
        actions={<><AppButton density="compact" variant="secondary" disabled>{t("Export")}</AppButton><AppButton density="compact" variant="primary" icon={Users} onClick={() => setDialog(true)}>{t("Edit student")}</AppButton></>}>
        <AppPanel title="Existing controls and semantic states" description="Comfortable defaults and explicit compact variants; no alternate UI implementation.">
            <div className="flex flex-wrap items-center gap-3">
                <AppButton variant="primary" onClick={() => setDialog(true)}>{t("Edit student")}</AppButton>
                <AppButton density="compact" isLoading>{t("Saving...")}</AppButton>
                <AppButton density="compact" variant="danger" disabled>{t("Deactivate")}</AppButton>
                {(["default", "success", "warning", "danger", "cyan", "purple"] as const).map((tone, index) => <Badge key={tone} variant={tone}>{t.owned(["Inactive", "Active", "Due", "Urgent", "Attendance", "Seat utilization"][index])}</Badge>)}
            </div>
        </AppPanel>
        <RecordListSurface label="Gallery record example" toolbar={<>
            <FormField id="gallery-search" label={t("Search students by name or phone")}><input value={query} onChange={event => setQuery(event.target.value)} className={`${formControlClass} px-3 py-2`} /></FormField>
            <div className="flex flex-wrap gap-3">
                <AppSelect aria-label="Gallery state" value={state} onValueChange={setState} options={["ready", "loading", "empty", "error", "restricted"].map(value => ({ value, label: value }))} />
                <AppSelect aria-label="Gallery density" value={density} onValueChange={value => setDensity(value as typeof density)} options={["compact", "comfortable"].map(value => ({ value, label: value }))} />
                <ViewToggle value={view} onChange={setView} />
            </div>
        </>} footer={<p className="text-xs">RecordListPage → RecordListSurface → DataTable / RecordListState; Dialog retains body portals.</p>} busy={state === "loading"}>
            {state !== "ready" ? <RecordListState kind={state as "loading" | "empty" | "error" | "restricted"} title={state === "loading" ? "Loading students" : state === "empty" ? "No students in this view yet." : state === "restricted" ? "Not included in your access" : "Something went wrong"} onRetry={state === "error" ? () => setState("ready") : undefined} /> : <DataTable density={density} caption="Students" data={rows} columns={[{ header: "Student", accessor: "name", rowHeader: true }, { header: "Status", accessor: row => <Badge variant={row.status === "Active" ? "success" : "default"}>{t.owned(row.status)}</Badge> }]} actions={() => <RowActionsMenu buttonLabel={t("Actions")} actions={[{ label: t("Edit Details"), icon: Pencil, onClick: () => setDialog(true) }, { label: t("Deactivate"), icon: PowerOff, disabled: true, onClick: () => undefined }]} />} viewMode={view} renderGridCard={row => <AppPanel title={row.name}><Badge>{t.owned(row.status)}</Badge><AppButton size="sm" className="mt-3" onClick={() => setDialog(true)}>{t("Edit Details")}</AppButton></AppPanel>} />}
        </RecordListSurface>
        <Dialog density="compact" open={dialog} title={t("Edit student")} description={t("Update profile details.")} onClose={() => setDialog(false)} footer={<><AppButton onClick={() => setDialog(false)}>{t("Cancel")}</AppButton><AppButton variant="primary" onClick={() => { setInvalid(!draft.trim()); if (draft.trim()) setNested(true); }}>{t("Save Changes")}</AppButton></>}>
            <FormField id="gallery-name" label={t("Full Name")} error={invalid ? t.error("Name is required.") : undefined} required><input data-dialog-initial-focus className={`${formControlClass} px-3 py-2`} value={draft} onChange={event => setDraft(event.target.value)} /></FormField>
            <AppButton className="mt-4" onClick={() => setNested(true)}>{t("View Fees")}</AppButton>
            <Dialog density="compact" open={nested} title={t("Payment history")} onClose={() => setNested(false)}><p className="text-sm">Nested presentation example. Escape closes this overlay first and returns focus to the parent control.</p><AppButton className="mt-4" onClick={() => setNested(false)}>{t("Cancel")}</AppButton></Dialog>
        </Dialog>
    </RecordListPage>;
}
