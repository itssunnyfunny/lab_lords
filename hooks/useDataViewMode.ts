"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { DataViewMode } from "@/components/tables/DataTable";

const DEFAULT_DATA_VIEW_MODE: DataViewMode = "table";
const DATA_VIEW_MODE_STORAGE_KEY = "lab-lords:data-view-mode";

const cachedViewModes = new Map<string, DataViewMode>();
const listenersByStorageKey = new Map<string, Set<() => void>>();

function isDataViewMode(value: unknown): value is DataViewMode {
    return value === "table" || value === "grid";
}

function getCachedViewMode(storageKey: string) {
    return cachedViewModes.get(storageKey) ?? DEFAULT_DATA_VIEW_MODE;
}

function setCachedViewMode(storageKey: string, viewMode: DataViewMode) {
    cachedViewModes.set(storageKey, viewMode);
}

function notifyViewModeListeners(storageKey: string) {
    listenersByStorageKey.get(storageKey)?.forEach(listener => listener());
}

function readStoredViewMode(storageKey: string): DataViewMode {
    if (typeof window === "undefined") return getCachedViewMode(storageKey);

    try {
        const storedValue = window.localStorage.getItem(storageKey);
        if (isDataViewMode(storedValue)) return storedValue;
    } catch {
        // Storage can be unavailable in restricted browser contexts.
    }

    return getCachedViewMode(storageKey);
}

function getViewModeSnapshot(storageKey: string) {
    const viewMode = readStoredViewMode(storageKey);
    setCachedViewMode(storageKey, viewMode);
    return viewMode;
}

function subscribeToViewMode(storageKey: string, listener: () => void) {
    let listeners = listenersByStorageKey.get(storageKey);
    if (!listeners) {
        listeners = new Set();
        listenersByStorageKey.set(storageKey, listeners);
    }
    listeners.add(listener);

    const handleStorage = (event: StorageEvent) => {
        if (event.key !== storageKey) return;
        const nextViewMode = isDataViewMode(event.newValue)
            ? event.newValue
            : DEFAULT_DATA_VIEW_MODE;
        setCachedViewMode(storageKey, nextViewMode);
        notifyViewModeListeners(storageKey);
    };

    if (typeof window !== "undefined") {
        window.addEventListener("storage", handleStorage);
    }

    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            listenersByStorageKey.delete(storageKey);
        }

        if (typeof window !== "undefined") {
            window.removeEventListener("storage", handleStorage);
        }
    };
}

export function useDataViewMode(storageKey = DATA_VIEW_MODE_STORAGE_KEY): readonly [DataViewMode, (viewMode: DataViewMode) => void] {
    const subscribe = useCallback((listener: () => void) => subscribeToViewMode(storageKey, listener), [storageKey]);
    const getSnapshot = useCallback(() => getViewModeSnapshot(storageKey), [storageKey]);
    const getServerSnapshot = useCallback(() => getCachedViewMode(storageKey), [storageKey]);
    const viewMode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const setViewMode = useCallback((nextViewMode: DataViewMode) => {
        setCachedViewMode(storageKey, nextViewMode);

        if (typeof window !== "undefined") {
            try {
                window.localStorage.setItem(storageKey, nextViewMode);
            } catch {
                // Keep the in-memory state even if persistence is blocked.
            }
        }

        notifyViewModeListeners(storageKey);
    }, [storageKey]);

    return [viewMode, setViewMode] as const;
}
