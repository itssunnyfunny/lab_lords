import dotenv from "dotenv";
dotenv.config({ path: './.env' });

async function verifyClient() {
    console.log("🧪 Verifying ai/llm/gemini.client.ts");

    // Dynamic import to ensure env is loaded first
    const { callGemini } = await import("../ai/llm/gemini.client");

    try {
        const response = await callGemini("Hello, this is a test from the verification script.");
        if (response) {
            console.log("✅ Client returned response:", response);
        } else {
            console.error("❌ Client returned null or undefined.");
            process.exit(1);
        }
    } catch (error: any) {
        console.error("❌ Client threw error:", error);
        process.exit(1);
    }
}

verifyClient();
