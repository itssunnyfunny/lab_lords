"use client";
import type { ReactNode } from "react";
import { ListFilter } from "lucide-react";
import { useTranslation } from "@/components/settings/LocalizedText";
import { PageShell } from "./PageShell";
import { AppPanel } from "./AppPanel";
import { ErrorState } from "./ErrorState";
import { LoadingTableSkeleton } from "./LoadingSkeleton";

/** Presentation slots only. The caller owns records, permissions and workflows. */
export function RecordListPage({ title, eyebrow, description, actions, notices, children, overlays }: {
    title: ReactNode; eyebrow?: ReactNode; description?: ReactNode;
    actions?: ReactNode; notices?: ReactNode; children: ReactNode; overlays?: ReactNode;
}) {
    return <PageShell className="ui-record-page" data-record-list="true">
        <header className="ui-record-header">
            <div className="min-w-0">
                {eyebrow && <p className="ui-record-eyebrow">{eyebrow}</p>}
                <h1>{title}</h1>
                {description && <p className="ui-record-description">{description}</p>}
            </div>
            {actions && <div className="ui-record-actions">{actions}</div>}
        </header>
        {notices}
        {children}
        {overlays}
    </PageShell>;
}

export function RecordListSurface({ toolbar, footer, children, busy = false, label }: {
    toolbar: ReactNode; footer?: ReactNode; children: ReactNode; busy?: boolean; label: string;
}) {
    return <AppPanel density="compact" padding="none" className="ui-record-surface" aria-label={label} aria-busy={busy || undefined}>
        <div className="ui-record-toolbar">{toolbar}</div>
        <div className="ui-record-results">{children}</div>
        {footer && <div className="ui-record-footer">{footer}</div>}
    </AppPanel>;
}

export function RecordListState({ kind, title, description, onRetry, action }: {
    kind: "loading" | "empty" | "error" | "restricted"; title: string; description?: string;
    onRetry?: () => void; action?: ReactNode;
}) {
    const t = useTranslation();
    if (kind === "loading") return <div role="status" aria-label={t.owned(title)} className="p-4"><span className="sr-only">{t.owned(title)}</span><LoadingTableSkeleton rows={5} /></div>;
    if (kind === "error" || kind === "restricted") return <ErrorState title={title} description={description ?? title} restricted={kind === "restricted"} onRetry={onRetry} action={action} className="rounded-none border-0" />;
    return <section className="ui-record-empty" aria-label={t.owned(title)}>
        <ListFilter size={24} aria-hidden="true" /><h2>{t.owned(title)}</h2>
        {description && <p>{t.owned(description)}</p>}{action}
    </section>;
}
