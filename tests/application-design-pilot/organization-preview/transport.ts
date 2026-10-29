import { clearDraft } from "./navigation";
import { apiClient } from "@/lib/api/core";
import { renewalCategories, renewalKey, renewalOrderKey, renewalQuerySchema, type RenewalPage, type RenewalRow } from "@/lib/renewals";
import { referenceDashboardFixture } from "../reference-fixture";
import { ORG, ORG_NAME, NOW, names, prices, permittedBranches, resolveBranch, writable, type Branch, type Fixture } from "./model";
import { identityKey, previewEnabled, readFixture, scopedMutation, updateBranch } from "./store";

const permissions = (owner: boolean) => Object.fromEntries(["manage_org", "manage_branch", "students", "seat_allocation", "view_payments", "generate_payments", "mark_payment_paid", "waive_payments", "analytics", "view_whatsapp", "send_whatsapp", "manage_whatsapp", "receive_whatsapp_reports", "staff_management"].map(key => [key, owner || key === "students"]));
export function accessFor(branch: Branch, state: Fixture) {
  const owner = state.role === "owner";
  const entitlements = branch.access === "STANDARD" ? ["STAFF_MANAGEMENT", "ADVANCED_ANALYTICS", "AI_ACCESS"] : branch.access === "PRO" ? ["STAFF_MANAGEMENT", "ADVANCED_ANALYTICS", "AI_ACCESS", "WHATSAPP_AUTOMATION"] : [];
  const effectivePlan = branch.status === "trial" ? "STANDARD_TRIAL" : branch.access;
  return { branchId: branch.id, branchName: branch.name, organizationId: ORG, isOwner: owner, role: owner ? "OWNER" : "STAFF", permissions: permissions(owner), entitlements, effectivePlan,
    billingExperience: { organizationId: ORG, accessMode: writable(branch) ? "FULL" : "READ_ONLY", effectivePlan, selectedPostTrialPlan: branch.selected ?? branch.billed,
      providerStatus: "ACTIVE", customerState: writable(branch) ? branch.status === "trial" ? "TRIAL_ACTIVE" : branch.access + "_ACTIVE" : "ACCESS_ENDED", customerMessage: "",
      trialEndsAt: branch.status === "trial" ? branch.until + "T00:00:00Z" : null, trialDaysRemaining: branch.status === "trial" ? 13 : null,
      paidThrough: writable(branch) ? "2026-11-28T00:00:00Z" : null, confirmedQuantity: 1, projectedQuantity: 1, currentUnitAmount: prices[branch.billed], currentMonthlyTotal: prices[branch.billed],
      projectedUnitAmount: prices[branch.scheduled?.plan ?? branch.billed], projectedMonthlyTotal: prices[branch.scheduled?.plan ?? branch.billed],
      authorizationStatus: "AUTHORIZED", planFeeDueToday: 0, nextChargeAt: "2026-11-28T00:00:00Z", paymentAction: "NONE", entitlements, latestOperation: null, activeOperation: null,
      scheduledChanges: [], branch: { id: branch.id, name: branch.name, billingStatus: "ACTIVE" }, viewer: { isOwner: owner, canManageBilling: owner } } };
}
const paged = (items: unknown[]) => ({ items, nextCursor: null, total: items.length });
function allocations(branch: Branch) { return branch.students.filter(s => s.seat && s.shiftId).map(s => ({ id: branch.id + "-allocation-" + s.id, branchId: branch.id, studentId: s.id, seatId: branch.id + "-seat-" + s.seat, shiftId: s.shiftId, multiShiftId: null, startDate: NOW, endDate: null, student: s, seat: { id: branch.id + "-seat-" + s.seat, label: String(s.seat).padStart(2,"0") }, shift: { ...branch.shifts.find(sh => sh.id === s.shiftId), startTime: "08:00", endTime: "12:00" }, multiShift: null })); }
function studentRows(branch: Branch) { return branch.students.map(s => ({ ...s, branchId: branch.id, status: "ACTIVE", joinedAt: NOW, createdAt: NOW, updatedAt: NOW, feeLinkedShiftId: null, feeLinkedMultiShiftId: null, seatAllocations: allocations(branch).filter(a => a.studentId === s.id) })); }
function feeRows(branch: Branch) { return branch.students.map(s => {
  const collected = branch.receipts.filter(r => r.studentId === s.id).reduce((sum,r) => sum + r.amount, 0);
  return { id: branch.id + "-fee-" + s.id, branchId: branch.id, studentId: s.id, type: "MONTHLY", amount: s.monthlyFee, collectedAmount: collected, waivedAmount: 0, ledgerBacked: true, status: collected >= s.monthlyFee ? "PAID" : "DUE", dueDate: "2026-10-28T00:00:00Z", periodStart: "2026-10-01T00:00:00Z", periodEnd: "2026-10-31T00:00:00Z", createdAt: NOW, student: s };
}); }
function renewalsFor(branch: Branch, params: URLSearchParams): RenewalPage {
  const query = renewalQuerySchema.parse(Object.fromEntries(params));
  const search = query.search.toLowerCase();
  const rows: RenewalRow[] = feeRows(branch).filter(fee => fee.status === "DUE")
    .filter(fee => !search || fee.student.name.toLowerCase().includes(search) || fee.student.phone.includes(search))
    .map<RenewalRow>(fee => ({
      key: renewalKey(fee.studentId, fee.type, fee.periodStart), studentId: fee.studentId,
      studentName: fee.student.name, phone: fee.student.phone, studentStatus: "ACTIVE", paymentId: fee.id,
      type: "MONTHLY", periodStart: fee.periodStart, periodEnd: fee.periodEnd, dueDate: fee.dueDate,
      amount: fee.amount - fee.collectedAmount - fee.waivedAmount, expected: false, followUp: null,
      allocations: allocations(branch).filter(row => row.studentId === fee.studentId)
        .map(row => ({ seat: row.seat.label, shift: row.shift.name ?? "" })),
    })).sort((a,b) => renewalOrderKey(a).localeCompare(renewalOrderKey(b)));
  const counts: RenewalPage["counts"] = { ALL: 0, TODAY: 0, UPCOMING: 0, OUTSTANDING: 0, OVERDUE: 0 };
  const asOf = new Date(NOW);
  for (const row of rows) for (const filter of renewalCategories(row, asOf, query.days)) counts[filter]++;
  const filtered = rows.filter(row => renewalCategories(row, asOf, query.days).includes(query.filter));
  const offset = Number(query.cursor ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Invalid preview cursor");
  const items = filtered.slice(offset, offset + query.limit);
  return { items, counts, outstandingAmount: rows.reduce((sum,row) => sum + row.amount, 0), expectedAmount: 0,
    nextCursor: offset + items.length < filtered.length ? String(offset + items.length) : null, asOf: NOW };
}
function dashboardFor(branch: Branch, state: Fixture) {
  const result = referenceDashboardFixture("empty", branch.id, "2026-10");
  const fees = feeRows(branch), collected = branch.receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
  const billed = fees.reduce((sum, fee) => sum + fee.amount, 0);
  const occupied = allocations(branch).length, capacity = branch.library.seatCount * branch.shifts.length;
  const day = NOW.slice(0,10);
  result.today = day; result.updatedAt = NOW;
  result.students.data = { active: branch.students.length, comparison: null,
    recent: studentRows(branch).slice(0,5).map(({id,name,status,joinedAt}) => ({id,name,status,joinedAt})) };
  result.money.data = { collectedThisMonth: collected, pendingDues: billed - collected, overdueAmount: 0, overdueStudents: 0, comparisonPercent: null };
  result.collections.data = { month: "2026-10", billed, collected, pending: billed-collected, waived: 0, rate: billed ? collected / billed * 100 : null,
    points: [{ date: day, billed, collected, pending: billed-collected, collectionRate: billed ? collected / billed * 100 : null }] };
  result.terms.data = { configured: false, renewalsThisWeek: 0, items: [] };
  result.attendance.data = { configured: false, expectedToday: 0, attendedToday: 0, gaps: 0, gapsStudents: [] };
  result.seating.data = { seats: branch.library.seatCount, shifts: branch.shifts.length, capacity, occupied,
    physicalSeatsInUse: new Set(branch.students.map(s => s.seat).filter(Boolean)).size,
    utilizationPercent: capacity ? occupied / capacity * 100 : 0, threshold: 35, lowUtilization: occupied / capacity < .35,
    coverageStartedAt: NOW, days: [day],
    rows: branch.shifts.map(shift => ({ id: shift.id, name: shift.name, startTime: shift.start, endTime: shift.end,
      cells: [{ date: day, capacity: branch.library.seatCount, occupied: branch.students.filter(s => s.shiftId === shift.id && s.seat).length, recordedAt: NOW }] })),
    seatsPreview: Array.from({length:branch.library.seatCount},(_,i)=>({id:branch.id+"-seat-"+(i+1),label:String(i+1).padStart(2,"0"),occupiedShifts:branch.students.filter(s=>s.seat===i+1).length})) };
  result.activity = branch.receipts.slice(0,5).map(receipt => ({ id: receipt.id, kind: "COLLECTION", amount: receipt.amount, occurredAt: receipt.date + "T12:00:00Z",
    studentName: branch.students.find(s => s.id === receipt.studentId)?.name ?? "", href: "/branch/" + branch.id + "/payments" }));
  if (state.role === "staff") {
    for (const key of ["money", "collections", "seating", "followUps", "terms"] as const) result[key] = { status:"restricted", data:null };
    result.activity = [];
  }
  return result;
}

export async function fixtureRequest(raw: string, method = "GET", body?: Record<string, unknown>, key = identityKey()): Promise<unknown> {
  const url = new URL(raw, window.location.origin);
  const path = url.pathname.replace(/^\/api/, "");
  const state = readFixture(key); // Snapshot captured before any delayed response.
  const branchId = path.match(/\/(?:branches|branch)\/([^/]+)/)?.[1];
  const branch = branchId ? resolveBranch(state, branchId) : undefined;
  const isRead = method === "GET";
  if (state.scenario === "slow" && isRead && branchId === "central" && path.endsWith("/students")) await new Promise(resolve => setTimeout(resolve, 1600));
  if (path === "/users/me") return { name: state.role === "owner" ? "Amit Kumar" : "Meera (staff)", interfaceLanguage: new URLSearchParams(window.location.search).get("lang") || "en", documentLanguage: "en", densityPreference: "comfortable", locale: "en-IN", timezone: "Asia/Kolkata", dateFormat: "dd MMM yyyy", ...body };
  if (path === "/workspaces") { const rows = permittedBranches(state).map(b => ({ id: b.id, name: b.name + " · " + names[b.billed], organizationId: ORG, organizationName: ORG_NAME, role: state.role === "owner" ? "OWNER" : "STAFF", permissions: permissions(state.role === "owner"), entitlements: accessFor(b,state).entitlements, href: "/branch/" + b.id }));
    return { organizations: state.role === "owner" ? [{ id: ORG, name: ORG_NAME, role:"OWNER", href: "/org/" + ORG, branches: rows }] : [], staffBranches: state.role === "staff" ? rows : [], defaultHref: state.role === "owner" ? "/org/" + ORG : rows[0]?.href || "/account" }; }
  if (!branch) throw new Error("Branch unavailable");
  if (path.endsWith("/access")) return accessFor(branch,state);
  if (path.endsWith("/notifications")) return {items:[]};
  if (path.endsWith("/search")) return [];
  const endpoint = path.slice(path.indexOf(branch.id) + branch.id.length);
  if (state.role === "staff" && !["/students", "/shifts", "/multi-shifts", "/dashboard", ""].includes(endpoint)) throw new Error("This action is not permitted");
  if (!isRead && (!writable(branch) || state.role !== "owner")) throw new Error("This branch is read-only");
  if (endpoint === "/students" && !isRead) return scopedMutation(key,branch.id, current => {
    const student = { id: branch.id + "-" + crypto.randomUUID(), name: String(body?.name), phone: String(body?.phone), monthlyFee: Number(body?.monthlyFee ?? current.library.monthlyFee), seat:null, shiftId:null };
    updateBranch(branch.id,b => ({...b,students:[student,...b.students]}),key); clearDraft(); return student;
  });
  if (!isRead) throw new Error("This operation is outside the navigation preview");
  if (endpoint === "/students") return paged(studentRows(branch).filter(s => (!url.searchParams.get("status") || s.status === url.searchParams.get("status")) && (!url.searchParams.get("q") || s.name.toLowerCase().includes(url.searchParams.get("q")!.toLowerCase()))));
  if (endpoint === "/shifts") return branch.shifts.map(s => ({...s,branchId:branch.id,startTime:s.start,endTime:s.end,active:true,monthlyFee:branch.library.monthlyFee}));
  if (endpoint === "/multi-shifts") return [];
  if (endpoint === "/shifts/capacity") return branch.shifts.map(s => ({shiftId:s.id,shiftName:s.name,totalSeats:branch.library.seatCount,occupiedSeats:branch.students.filter(x=>x.shiftId===s.id).length,availableSeats:branch.library.seatCount-branch.students.filter(x=>x.shiftId===s.id).length}));
  if (endpoint.endsWith("/seat-map")) { const shift = branch.shifts.find(s=>s.id===endpoint.split("/")[2]) ?? branch.shifts[0]; const seats = Array.from({length:branch.library.seatCount},(_,i)=>{ const s=branch.students.find(s=>s.seat===i+1&&s.shiftId===shift.id);return {seatId:branch.id+"-seat-"+(i+1),label:String(i+1).padStart(2,"0"),occupied:!!s,occupiedBy:s?.name??null}; }); return {shiftId:shift.id,shiftName:shift.name,isReserved:false,totalSeats:seats.length,occupiedCount:seats.filter(s=>s.occupied).length,availableCount:seats.filter(s=>!s.occupied).length,seats}; }
  if (endpoint === "/seats") return paged(Array.from({length:branch.library.seatCount},(_,i)=>({id:branch.id+"-seat-"+(i+1),label:String(i+1).padStart(2,"0"),branchId:branch.id,seatAllocations:allocations(branch).filter(a=>a.seatId===branch.id+"-seat-"+(i+1))})));
  if (endpoint === "/seat-allocations") return paged(allocations(branch));
  if (endpoint === "/payments") return paged(feeRows(branch).filter(p=>!url.searchParams.get("status") || p.status===url.searchParams.get("status")));
  if (endpoint === "/renewals") return renewalsFor(branch,url.searchParams);
  if (endpoint === "/dashboard") return dashboardFor(branch,state);
  if (endpoint === "") return { id:branch.id, name:branch.name, organizationId:ORG, billingStatus:"ACTIVE",totalSeats:branch.library.seatCount,organization:{id:ORG,name:ORG_NAME}, shifts:branch.shifts };
  if (["/staff","/tasks","/collections","/staff-invites"].includes(endpoint)) return paged([]);
  if (endpoint === "/analytics") return {};
  throw new Error("This operation is outside the navigation preview");
}
let installed = false;
export function installFixtureTransport() {
  if (installed) return; installed = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw,window.location.origin);
    if (!previewEnabled() || url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) return originalFetch(input,init);
    const key = identityKey();
    try { const data = await fixtureRequest(url.href,init?.method || "GET",typeof init?.body === "string" ? JSON.parse(init.body) : undefined,key); return new Response(JSON.stringify(data),{status:200,headers:{"Content-Type":"application/json"}}); }
    catch(error) {return new Response(JSON.stringify({error:error instanceof Error?error.message:"Preview unavailable"}),{status:403,headers:{"Content-Type":"application/json"}});}
  };
  apiClient.interceptors.request.use(config => {
    if (previewEnabled()) {
      const key = identityKey();
      config.adapter = async request => {
        const params = new URLSearchParams(Object.entries(request.params || {}).filter(([,v])=>v!==undefined).map(([k,v])=>[k,String(v)]));
        const path = "/api" + request.url + (params.size ? (request.url?.includes("?") ? "&" : "?") + params : "");
        const data = await fixtureRequest(path,request.method?.toUpperCase() || "GET",typeof request.data === "string" ? JSON.parse(request.data) : request.data,key);
        return {data,status:200,statusText:"OK",headers:{},config:request};
      };
    }
    return config;
  });
}
