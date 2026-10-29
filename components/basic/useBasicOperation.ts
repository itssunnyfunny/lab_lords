"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export type BasicOperation = { version: 1; scope: string; kind: "student" | "edit" | "assign" | "move" | "payment" | "setup"; url: string; method: "POST" | "PATCH"; body: Record<string, unknown>; key: string };
export class OperationError extends Error { constructor(message: string, readonly status: number) { super(message); } }
export async function basicRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch("/api" + url, { cache: "no-store", ...options });
    const value = await response.json().catch(() => null);
    if (!response.ok) throw new OperationError(value?.error ?? "Unable to confirm the operation.", response.status);
    return value as T;
}
/** No dispatch in effects: reload, identity changes and navigation cannot replay a command. */
export function useBasicOperation(scope: string, onConfirmed: () => void) {
    const storageKey = "basic-operation:v1:" + scope;
    const [saved, setSaved] = useState<BasicOperation | null>(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const live = useRef(true), busy = useRef(false);
    useEffect(() => {
        live.current = true;
        try {
            const value = JSON.parse(sessionStorage.getItem(storageKey) ?? "null") as BasicOperation | null;
            if (value?.version === 1 && value.scope === scope) setSaved(value);
        } catch { setError("Saved recovery details are unavailable. Check the records before trying again."); }
        return () => { live.current = false; };
    }, [scope, storageKey]);
    const clear = useCallback(() => {
        sessionStorage.removeItem(storageKey);
        if (live.current) { setSaved(null); setError(""); }
    }, [storageKey]);
    async function run<T>(command: BasicOperation): Promise<T | undefined> {
        if (busy.current) return;
        busy.current = true;
        try {
            // Storage failure must stop the dispatch, rather than lose its recovery identity.
            sessionStorage.setItem(storageKey, JSON.stringify(command));
            if (live.current) { setSaved(command); setPending(true); setError(""); }
            const result = await basicRequest<T>(command.url, {
                method: command.method, headers: { "Content-Type": "application/json", "Idempotency-Key": command.key },
                body: JSON.stringify(command.body),
            });
            clear();
            if (live.current) onConfirmed();
            return live.current ? result : undefined;
        } catch (cause) {
            // Only explicit validation rejections are conclusive. Access/transport errors
            // can follow a committed response; retain the frozen request for recovery.
            if (cause instanceof OperationError && cause.status === 400) clear();
            if (live.current) setError(cause instanceof Error ? cause.message : "Unable to confirm the operation.");
        } finally { busy.current = false; if (live.current) setPending(false); }
    }
    const command = (kind: BasicOperation["kind"], url: string, method: BasicOperation["method"], body: Record<string, unknown>): BasicOperation => ({
        version: 1, scope, kind, url, method, body, key: crypto.randomUUID(),
    });
    return { saved, pending, error, setError, run, clear, command };
}
