"use client";
import { useTranslation } from "@/components/settings/LocalizedText";

/** Static illustrations: no workspace data, navigation or premium components. */
export function WorkspacePreviews() {
    const t = useTranslation();
    return <details className="mt-5 rounded-xl border border-[color:var(--ui-panel-border)] p-4">
        <summary className="cursor-pointer py-2 text-sm font-semibold">{t("Compare Simple and Full workspaces")}</summary>
        <p className="my-3 text-sm text-[color:var(--text-secondary)]">{t("Illustrative previews. Your effective access chooses the workspace; previews do not unlock features.")}</p>
        <div className="grid gap-4 md:grid-cols-2">
            {(["simple", "full"] as const).map(mode => <figure key={mode}>
                <figcaption className="mb-2 font-semibold">{t(mode === "simple" ? "Simple workspace · Basic ₹99" : "Full workspace · Standard ₹299 / Pro ₹499")}</figcaption>
                <div aria-hidden="true" className="flex h-44 overflow-hidden rounded-xl border border-[#dfe7dc] bg-[#fffbf4] p-3">
                    <div className="mr-3 w-12 shrink-0 space-y-3 border-r border-[#dfe7dc] pr-2">{Array.from({length:mode === "simple" ? 4 : 8},(_,i)=><div key={i} className="h-2 rounded bg-[#c7ddcb]"/>)}</div>
                    <div className="flex-1"><div className="mb-3 h-3 w-2/3 rounded bg-[#a8c5af]"/><div className="mb-3 grid grid-cols-3 gap-2">{[0,1,2].map(i=><div key={i} className="h-8 rounded border border-[#dfe7dc] bg-white"/>)}</div>
                        {mode === "simple" ? <div className="grid grid-cols-6 gap-2">{Array.from({length:18},(_,i)=><div key={i} className={`h-3 rounded ${i % 3 ? "bg-[#95cfa2]" : "border border-[#c7ddcb] bg-white"}`}/>)}</div> : <div className="flex h-20 items-end gap-2 rounded border border-[#dfe7dc] bg-white p-2">{[25,55,40,70,50,85,65].map((height,i)=><div key={i} className="flex-1 rounded-t bg-[#95cfa2]" style={{height:`${height}%`}}/>)}</div>}
                    </div>
                </div>
                <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{t.owned(mode === "simple" ? "Students, seats and student fees, with partial payments and receipts." : "The full workspace adds imports, attendance, tasks, follow-ups, staff, analytics and AI reports. Pro also includes WhatsApp, subject to setup and usage terms.")}</p>
            </figure>)}
        </div>
    </details>;
}
