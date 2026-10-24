"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppButton, Dialog } from "@/components/ui";
import { importSessions, type ImportRecipe } from "@/lib/api/importSessions";
import { useTranslation } from "@/components/settings/LocalizedText";

export function ImportRecipeManager({ branchId, canDelete }: { branchId: string; canDelete: boolean }) {
    const t = useTranslation(); const [open, setOpen] = useState(false);
    return <><AppButton density="compact" variant="secondary" onClick={() => setOpen(true)}>{t.owned("Saved import recipes")}</AppButton>{open && <RecipeDialog key={branchId} branchId={branchId} canDelete={canDelete} onClose={() => setOpen(false)} />}</>;
}
function RecipeDialog({ branchId, canDelete, onClose }: { branchId: string; canDelete: boolean; onClose: () => void }) {
    const t = useTranslation(); const [recipes, setRecipes] = useState<ImportRecipe[]>([]);
    const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
    const [selected, setSelected] = useState<ImportRecipe | null>(null); const sequence = useRef(0);
    const load = useCallback(async () => {
        const request = ++sequence.current; setLoading(true); setError("");
        try { const rows = await importSessions.listRecipes(branchId); if (request === sequence.current) setRecipes(rows); }
        catch { if (request === sequence.current) setError("Unable to load saved import recipes."); }
        finally { if (request === sequence.current) setLoading(false); }
    }, [branchId]);
    useEffect(() => { void load(); const version = sequence; return () => { version.current++; }; }, [load]);
    async function remove() {
        if (!selected || !canDelete || busy) return;
        setBusy(true); setError("");
        try { await importSessions.deleteRecipe(branchId, selected.id); setSelected(null); await load(); }
        catch { setError("Unable to delete the recipe. Refresh the list before trying again."); }
        finally { setBusy(false); }
    }
    return <Dialog density="compact" open title={t.owned("Saved import recipes")} onClose={onClose} closeDisabled={busy}
        footer={<><AppButton variant="secondary" disabled={busy} onClick={onClose}>{t("Close")}</AppButton><AppButton variant="secondary" disabled={busy || loading} onClick={() => void load()}>{t("Refresh")}</AppButton></>}>
        <div className="space-y-3"><p>{t.owned("Recipes belong to this organization. Deleting a recipe removes it from future suggestions and keeps past imports unchanged.")}</p>
            {error && <p role="alert">{t.owned(error)}</p>}
            {loading ? <p role="status">{t("Loading…")}</p> : !recipes.length ? <p>{t.owned("No saved import recipes.")}</p> : <ul className="divide-y divide-[color:var(--ui-panel-border)]">{recipes.map(recipe => <li key={recipe.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="min-w-0 break-words">{recipe.name}</span><AppButton density="compact" variant="secondary" disabled={!canDelete || busy} onClick={() => { setError(""); setSelected(recipe); }}>{t("Delete")}</AppButton></li>)}</ul>}
            {selected && <div className="space-y-3 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-panel-border)] p-3"><p className="break-words">{t.owned("Delete saved recipe?")} {selected.name}</p><div className="flex flex-wrap gap-2"><AppButton variant="secondary" disabled={busy} onClick={() => setSelected(null)}>{t("Cancel")}</AppButton><AppButton variant="danger" disabled={!canDelete} isLoading={busy} onClick={() => void remove()}>{t.owned("Confirm recipe deletion")}</AppButton></div></div>}
        </div>
    </Dialog>;
}
