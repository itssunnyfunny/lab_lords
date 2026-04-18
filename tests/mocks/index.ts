import { vi } from "vitest";

/**
 * MOCK REGISTRY
 *
 * RULE: Mock anything with external cost or side-effects.
 * RULE: Never mock the database (we use a real test DB for accuracy).
 *
 * | Component         | Strategy          | Reason                              |
 * |-------------------|-------------------|-------------------------------------|
 * | PostgreSQL/Prisma | REAL (test DB)    | Integration accuracy                |
 * | @google/genai     | MOCK              | Costs money + network flakiness     |
 * | Payment gateway   | MOCK              | Costs money + side-effects          |
 * | WhatsApp sender   | MOCK              | External side-effects               |
 * | Date / new Date() | FAKE (vi timers)  | Determinism for billing logic       |
 * | next/headers      | MOCK              | Not available in Node test env      |
 */

// ─── AI (Google Gemini) ───────────────────────────────────────────────────────
// Usage: import { mockAI } from "@/tests/mocks"
// Then in test: mockAI.generateContent.mockResolvedValueOnce({ ... })

export const mockAI = {
  generateContent: vi.fn().mockResolvedValue({
    response: {
      text: () => JSON.stringify({ insights: [], risks: [], suggestions: [] }),
    },
  }),
};

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: mockAI.generateContent,
    },
  })),
}));

// ─── Next.js headers (cookies, headers API) ──────────────────────────────────
// Required in any test that imports from next/headers (auth middleware etc.)

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => ({ value: "mock-session-token" })),
    set: vi.fn(),
  })),
  headers: vi.fn(() => new Map()),
}));

// ─── Reset all mocks between tests (call in afterEach) ───────────────────────

export function resetAllMocks() {
  vi.clearAllMocks();
}
