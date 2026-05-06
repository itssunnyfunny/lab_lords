import axios from "axios";

export const apiClient = axios.create({
    baseURL: "/api",
    headers: {
        "Content-Type": "application/json",
    },
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
