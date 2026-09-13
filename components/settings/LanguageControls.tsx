"use client";
import { useRef, useState } from "react";
import { LANGUAGE_OPTIONS, type InterfaceLanguage } from "@/lib/i18n/language";
import { translate } from "@/lib/i18n";
import { notifyUserPreferencesChanged, useUserPreferences } from "./UserPreferencesApplier";
import { formControlClass } from "@/components/ui/formSurface";

export function LanguageControls({ documentOnly = false, compact = false }: { documentOnly?: boolean; compact?: boolean }) {
    const preferences = useUserPreferences();
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<"Saved" | "Unable to save language. Try again." | null>(null);
    const inFlight = useRef(false);
    async function save(field: "interfaceLanguage" | "documentLanguage", value: InterfaceLanguage) {
        if (inFlight.current) return;
        inFlight.current = true; setBusy(true); setResult(null);
        try {
            const response = await fetch("/api/users/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
            if (!response.ok) throw new Error("save");
            // Publish only the requested field. A concurrent profile save cannot change other purposes.
            notifyUserPreferencesChanged({ [field]: value }, preferences.ownerKey);
            setResult("Saved");
        } catch { setResult("Unable to save language. Try again."); }
        finally { inFlight.current = false; setBusy(false); }
    }
    const fields = documentOnly ? ["documentLanguage"] as const : compact ? ["interfaceLanguage"] as const : ["interfaceLanguage", "documentLanguage"] as const;
    if (preferences.ownerKey === "signed-out") return null;
    return <div className={compact ? "max-w-32 text-xs" : "space-y-3 p-4 text-sm"}>
        {fields.map(field => <label key={field} className="block space-y-1">
            <span className={compact ? "sr-only" : "block"}>{translate(preferences.interfaceLanguage, field === "interfaceLanguage" ? "Interface language" : "Document language")}</span>
            <select className={`${formControlClass} min-h-11 w-full px-2`} value={preferences[field]} disabled={busy}
                onChange={e => void save(field, e.target.value as InterfaceLanguage)}>
                {LANGUAGE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
        </label>)}
        {!compact && !documentOnly && <p>{translate(preferences.interfaceLanguage, "Screen language does not change messages, receipts, reports or date settings.")}</p>}
        {result && <p role="status">{translate(preferences.interfaceLanguage, result)}</p>}
    </div>;
}
