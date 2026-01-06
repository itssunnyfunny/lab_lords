// lib/auth.ts

export type SessionUser = {
  id: string
  email?: string
}

/**
 * TEMP AUTH HELPER
 * ----------------
 * This function pretends the user is authenticated.
 * Replace later with real auth (NextAuth / Clerk / Auth.js).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  // 🔴 QUICK FIX:
  // Hardcoded user for development
  return {
    id: "user_alice",
    email: "alice@example.com",
  }
}
