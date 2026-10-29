import { workspaceReturnPath } from "@/lib/contextualNavigation";
import { sampleLibrary, sampleReceipts, sampleShifts, sampleStudents, type Library, type Receipt, type Shift, type Student } from "../basic-prototype/sample";

export type Plan = "BASIC" | "STANDARD" | "PRO";
export type Locale = "en" | "hi" | "hinglish";
export type Branch = {
  id: string; name: string; billed: Plan; access: Plan | "NONE";
  status: "active" | "trial" | "grant" | "expired" | "pending" | "archived";
  until?: string; scheduled?: { plan: Plan; at: string }; selected?: Plan;
  students: Student[]; receipts: Receipt[]; library: Library; shifts: Shift[];
};
export type Fixture = { version: 1; branches: Branch[]; role: "owner" | "staff"; scenario: string; revision: number };
export const ORG = "org-pilot";
export const ORG_NAME = "Shanti Learning Spaces";
export const prices: Record<Plan, number> = { BASIC: 99, STANDARD: 299, PRO: 499 };
export const names: Record<Plan, string> = { BASIC: "Basic", STANDARD: "Standard", PRO: "Pro" };
export const NOW = "2026-10-28T12:00:00Z"; // Frozen review clock, never production billing truth.
export function createFixture(role = "owner", scenario = "basic"): Fixture {
  const branches: Branch[] = (["BASIC", "STANDARD", "PRO"] as Plan[]).map((plan, index) => {
    const id = ["pilot", "central", "riverside"][index];
    const name = ["Saraswati Library", "Central Study Hall", "Riverside Reading Room"][index];
    const students = structuredClone(sampleStudents).map((student, i) => ({
      ...student, id: id + "-" + student.id,
      name: index === 0 ? student.name : (index === 1 ? ["Kavya Sen", "Vivek Das", "Tara Shah"] : ["Zoya Khan", "Neil Kapoor", "Riya Bose"])[i % 3] + (i > 2 ? " " + (i + 1) : ""),
    }));
    return { id, name, billed: plan, access: plan, status: "active" as const, students,
      receipts: structuredClone(sampleReceipts).map(r => ({ ...r, id: id + "-" + r.id, studentId: id + "-" + r.studentId })),
      library: { ...sampleLibrary, name }, shifts: structuredClone(sampleShifts) };
  });
  if (scenario !== "future-mixed") {
    const plan: Plan = scenario === "standard" ? "STANDARD" : scenario === "pro" ? "PRO" : "BASIC";
    branches.forEach(branch => { branch.billed=plan; branch.access=plan; });
  }
  if (scenario === "trial") Object.assign(branches[0], { access: "STANDARD", status: "trial", until: "2026-11-10", selected: "BASIC" });
  if (scenario === "grant") Object.assign(branches[0], { access: "PRO", status: "grant", until: "2026-11-03" });
  if (scenario === "expired") Object.assign(branches[0], { access: "NONE", status: "expired" });
  if (scenario === "pending") Object.assign(branches[0], { access: "NONE", status: "pending" });
  if (scenario === "archived") Object.assign(branches[0], { access: "NONE", status: "archived" });
  if (scenario === "scheduled") branches[0].scheduled = { plan: "STANDARD", at: "2026-11-28" };
  if (scenario !== "future-mixed" && ["trial","grant","expired","scheduled"].includes(scenario)) {
    const {billed,access,status,until,scheduled,selected}=branches[0];
    branches.forEach(branch=>Object.assign(branch,{billed,access,status,until,scheduled,selected}));
  }
  return { version: 1, branches: scenario === "empty" ? [] : scenario === "single" ? branches.slice(0, 1) : branches, role: role === "staff" ? "staff" : "owner", scenario, revision: 0 };
}
export const permittedBranches = (state: Fixture) => state.branches.filter(b => state.role === "owner" || b.id === "pilot" || b.id === "central");
export const resolveBranch = (state: Fixture, id: string) => permittedBranches(state).find(b => b.id === id);
export const writable = (branch: Branch) => branch.access !== "NONE" && !["expired", "pending", "archived"].includes(branch.status);
export function switchDestination(pathname: string, branch: Branch, role: Fixture["role"]) {
  const area = pathname.match(/^\/branch\/[^/]+(?:\/([^/]+))?/)?.[1] || "";
  const normalized = area === "payments" || area === "fees" ? "fees" : area === "settings" || area === "setup" ? "setup" : area;
  const common = role === "owner" ? ["", "students", "seats", "fees", "setup"] : ["", "students"];
  const full = branch.access !== "BASIC" && branch.access !== "NONE";
  const permitted = common.includes(normalized) || (full && role === "owner" && ["attendance", "allocations", "shifts", "reports", "analytics", "staff", "tasks", "follow-ups", "renewals", "overdue"].includes(area));
  const next = permitted ? (full ? normalized === "fees" ? "payments" : normalized === "setup" ? "settings" : normalized : normalized) : "";
  // A student/detail identifier never crosses branch boundaries.
  return "/branch/" + branch.id + (next ? "/" + next : "");
}
export function schedulePlan(state: Fixture, branchId: string, plan: Plan): Fixture {
  if (state.role !== "owner" || !resolveBranch(state, branchId)) throw new Error("Branch unavailable");
  return { ...state, revision: state.revision + 1, branches: state.branches.map(b => (state.scenario !== "future-mixed" || b.id === branchId) ? { ...b, selected: undefined, scheduled: { plan, at: "2026-11-28" } } : b) };
}
export function applyScheduled(state: Fixture, branchId: string): Fixture {
  if (state.role !== "owner") throw new Error("Not permitted");
  return { ...state, revision: state.revision + 1, branches: state.branches.map(b => (state.scenario !== "future-mixed" || b.id === branchId) && b.scheduled ? { ...b, billed: b.scheduled.plan, access: b.scheduled.plan, status: "active", scheduled: undefined, until: undefined } : b) };
}

export function accountReturnDestination(state: Fixture, requested: string | null): string {
  const safe = workspaceReturnPath(requested);
  const id = safe?.match(/^\/branch\/([^/]+)/)?.[1];
  const branch = id ? resolveBranch(state, id) : undefined;
  if (branch && safe) return switchDestination(safe, branch, state.role);
  const organization = "/org/" + ORG;
  if (state.role === "owner") {
    return safe && [organization, organization + "/settings", organization + "/billing"].includes(safe) ? safe : organization;
  }
  return "/branch/" + (permittedBranches(state)[0]?.id ?? "pilot");
}
