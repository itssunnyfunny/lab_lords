import { useSyncExternalStore } from "react";
import { createFixture, resolveBranch, type Fixture, type Branch } from "./model";
const stores = new Map<string, Fixture>();
const listeners = new Set<() => void>();
export function previewEnabled() { const p = new URLSearchParams(window.location.search); return p.get("journey") === "org" || (p.get("plan") === "BASIC" && p.get("legacy") !== "1"); }
export function identityKey() {
  const p = new URLSearchParams(window.location.search);
  return ["org-preview-v2", encodeURIComponent(p.get("identity") || "owner"), p.get("role") === "staff" ? "staff" : "owner", p.get("case") || "basic"].join(":");
}
export function readFixture(key = identityKey()): Fixture {
  if (!stores.has(key)) {
    const [, , role, scenario] = key.split(":");
    let initial = createFixture(role, scenario);
    try { const saved = JSON.parse(sessionStorage.getItem(key) || "null") as Fixture | null;
      if (saved?.version === 1 && saved.role === initial.role && saved.scenario === scenario && Array.isArray(saved.branches)) initial = saved;
    } catch { /* A private/disabled browser store simply resets synthetic fixtures. */ }
    stores.set(key, initial);
  }
  return stores.get(key)!;
}
export function updateFixture(change: (state: Fixture) => Fixture, key = identityKey()) {
  const previous = readFixture(key);
  const next = change(previous);
  stores.set(key, next);
  try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* In-memory preview still works. */ }
  listeners.forEach(listener => listener());
}
export function updateBranch(id: string, change: (branch: Branch) => Branch, key = identityKey()) {
  updateFixture(state => {
    if (!resolveBranch(state, id)) throw new Error("Branch unavailable");
    return { ...state, revision: state.revision + 1, branches: state.branches.map(b => b.id === id ? change(b) : b) };
  }, key);
}
export function useFixture() { return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => readFixture(), () => readFixture()); }
export function resetFixture() {
  const key = identityKey(); stores.delete(key); sessionStorage.removeItem(key); readFixture(key); listeners.forEach(listener => listener());
}
let busy = 0;
export const isMutationPending = () => busy > 0;
export async function scopedMutation<T>(key: string, branchId: string, action: (branch: Branch) => T): Promise<T> {
  busy++;
  try {
    if (new URLSearchParams(window.location.search).get("case") === "slow") await new Promise(resolve => setTimeout(resolve, 1200));
    const branch = resolveBranch(readFixture(key), branchId);
    if (!branch) throw new Error("Branch unavailable");
    const result = action(branch);
    return result;
  } finally { busy--; }
}
