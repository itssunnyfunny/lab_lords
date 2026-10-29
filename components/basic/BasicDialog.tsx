"use client";
import type { ReactNode } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useTranslation } from "@/components/settings/LocalizedText";
export function BasicDialog({ title, children, onClose, pending = false }: { title: string; children: ReactNode; onClose: () => void; pending?: boolean }) {
    const t = useTranslation();
    return <Dialog open title={t.owned(title)} onClose={onClose} closeDisabled={pending}
        dismissOnBackdrop={false} overlayClassName="bp-prototype bp-modal-overlay" className="bp-modal-card" languagePlacement="header">
        {children}
    </Dialog>;
}
