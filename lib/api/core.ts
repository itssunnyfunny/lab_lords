import axios from "axios";

// Helper to get the current user ID
// In a real app, this would come from a session, cookie, or context
// For Phase 0/1, we might rely on a localStorage value or a hardcoded fallback until Auth is robust
export const getCurrentUserId = (): string | null => {
    if (typeof window !== "undefined") {
        return localStorage.getItem("x-user-id");
    }
    return null;
};

export const apiClient = axios.create({
    baseURL: "/api",
    headers: {
        "Content-Type": "application/json",
    },
});

apiClient.interceptors.request.use((config) => {
    const userId = getCurrentUserId();
    if (userId) {
        config.headers["x-user-id"] = userId;
    }
    return config;
});

apiClient.interceptors.response.use(
    (response) => response.data,
    (error) => {
        // Standardize error reporting
        // API routes return { error: string } mostly
        const message = error.response?.data?.error || error.message || "An unexpected error occurred";

        // Optionally wrap in a custom Error object or just return the rejected promise with message
        return Promise.reject(new Error(message));
    }
);
