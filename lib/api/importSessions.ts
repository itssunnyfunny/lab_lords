import { apiClient } from "./core";
import type { CommitMode, ImportColumnMapping, ImportOptions } from "@/importing/contracts/import-session.contract";

type DetailOptions = {
    rowFilter?: "attention" | "ready" | "all" | "skipped";
    limit?: number;
    cursor?: string | number | null;
};

async function parseResponse(response: Response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Import request failed");
    return data;
}

export const importSessions = {
    list(branchId: string): Promise<unknown> {
        return apiClient.get<unknown, unknown>(`/branches/${branchId}/import-sessions`);
    },

    createFromFile(branchId: string, file: File): Promise<{ id: string }> {
        const form = new FormData();
        form.append("file", file);
        return fetch(`/api/branches/${branchId}/import-sessions`, {
            method: "POST",
            body: form,
        }).then(parseResponse);
    },

    createFromPastedTable(branchId: string, pastedTable: string): Promise<{ id: string }> {
        return apiClient.post<unknown, { id: string }>(`/branches/${branchId}/import-sessions`, { pastedTable, fileName: "Pasted table" });
    },

    detail<T = unknown>(branchId: string, sessionId: string, options: DetailOptions = {}): Promise<T> {
        const params = new URLSearchParams();
        if (options.rowFilter) params.set("rowFilter", options.rowFilter);
        if (options.limit) params.set("limit", String(options.limit));
        if (options.cursor) params.set("cursor", String(options.cursor));
        const query = params.toString();
        return apiClient.get<unknown, T>(`/branches/${branchId}/import-sessions/${sessionId}${query ? `?${query}` : ""}`);
    },

    analyze<T = unknown>(branchId: string, sessionId: string): Promise<T> {
        return apiClient.post<unknown, T>(`/branches/${branchId}/import-sessions/${sessionId}/analyze`, {});
    },

    updateMapping<T = unknown>(branchId: string, sessionId: string, data: { columnMappings?: ImportColumnMapping[]; importOptions?: Partial<ImportOptions> }): Promise<T> {
        return apiClient.patch<unknown, T>(`/branches/${branchId}/import-sessions/${sessionId}/mapping`, data);
    },

    updateRows<T = unknown>(branchId: string, sessionId: string, data: { edits?: unknown[]; skipRowIds?: string[]; unskipRowIds?: string[] }): Promise<T> {
        return apiClient.patch<unknown, T>(`/branches/${branchId}/import-sessions/${sessionId}/rows`, data);
    },

    answerQuestion<T = unknown>(branchId: string, sessionId: string, data: { questionId: string; answer: unknown; applyToAffectedRows?: boolean }): Promise<T> {
        return apiClient.post<unknown, T>(`/branches/${branchId}/import-sessions/${sessionId}/questions`, data);
    },

    preview<T = unknown>(branchId: string, sessionId: string, mode: CommitMode = "SAFE_PARTIAL"): Promise<T> {
        return apiClient.get<unknown, T>(`/branches/${branchId}/import-sessions/${sessionId}/preview?mode=${mode}`);
    },

    commit<T = unknown>(branchId: string, sessionId: string, mode: CommitMode = "SAFE_PARTIAL"): Promise<T> {
        return apiClient.post<unknown, T>(`/branches/${branchId}/import-sessions/${sessionId}/commit`, { confirm: true, mode });
    },
};
