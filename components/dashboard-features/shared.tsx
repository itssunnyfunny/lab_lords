"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppButton, PageShell } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { formControlClass } from "@/components/ui/formSurface";
export const inputClass = `${formControlClass} min-h-11 px-3 py-2`;
export const tableClass = "w-full text-left text-sm [&_th]:whitespace-nowrap [&_th]:px-3 [&_th]:py-3 [&_th]:font-medium [&_th]:text-[color:var(--text-muted)] [&_td]:px-3 [&_td]:py-3 [&_tr]:border-b [&_tr]:border-[color:var(--ui-panel-border)]";

export async function dashboardRequest<T>(url: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, { method, cache: "no-store", signal,
        ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Something went wrong. Try again.");
    return payload;
}
export function useDashboardResource<T>(url: string) {
    const [state, setState] = useState<{ url: string; data: T | null; error: string | null; loading: boolean }>({ url, data: null, error: null, loading: true });
    const active = useRef<AbortController | null>(null);
    const load = useCallback(async () => {
        active.current?.abort();
        const controller = new AbortController(); active.current = controller;
        setState(current => ({ url, data: current.url === url ? current.data : null, error: null, loading: true }));
        try {
            const data = await dashboardRequest<T>(url, "GET", undefined, controller.signal);
            if (!controller.signal.aborted) setState({ url, data, error: null, loading: false });
        } catch (error) {
            if (!controller.signal.aborted) setState(current => ({ ...current, error: error instanceof Error ? error.message : "Something went wrong. Try again.", loading: false }));
        }
    }, [url]);
    useEffect(() => { void load(); return () => active.current?.abort(); }, [load]);
    return { data: state.url === url ? state.data : null, error: state.url === url ? state.error : null, loading: state.url !== url || state.loading, reload: load };
}
export function FeaturePage({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) {
    const t = useTranslation();
    return <PageShell><div className="space-y-5"><header className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="font-[family-name:var(--font-public-display)] text-3xl font-semibold">{t.owned(title)}</h1><p className="mt-2 max-w-3xl text-sm text-[color:var(--text-secondary)]">{t.owned(description)}</p></div>{action}</header>{children}</div></PageShell>;
}
export function ResourceError({ error, retry }: { error: string | null; retry?: () => void }) {
    const t = useTranslation();
    if (!error) return null;
    return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{t.error(error)}{retry && <AppButton variant="secondary" onClick={retry}>{t("Retry")}</AppButton>}</div>;
}
