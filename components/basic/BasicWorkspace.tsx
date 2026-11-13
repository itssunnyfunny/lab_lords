"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { RouteTitleUpdater } from "@/components/layout/RouteTitleUpdater";
import { usePathname, useRouter } from "next/navigation";
import { Armchair, ArrowLeft, ArrowRight, Check, ChevronRight, House, IndianRupee, Plus, Search, Settings, UploadCloud, Users } from "lucide-react";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { SidebarFrame } from "@/components/layout/SidebarFrame";
import { SidebarItem } from "@/components/layout/SidebarItem";
import { Drawer } from "@/components/ui/Drawer";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Menu } from "lucide-react";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { useTranslation } from "@/components/settings/LocalizedText";
import { getBranchCapabilityDecision, hasBranchCapability, type BranchCapabilityKey } from "@/lib/branchCapabilities";
import { validatePhone, validateRequiredText } from "@/lib/formValidation";
import type { BranchAccess } from "@/types";
import type { StudentListItem } from "@/lib/api/students";
import type { FeeCollectionView } from "@/lib/feeCollections";
import { remainingFee } from "@/lib/feeBalance";
import { isOverdue } from "@/lib/utils/paymentStatus";
import { activeAllocations, initials, loadBasicData, type BasicData } from "./data";
import { basicRequest, useBasicOperation } from "./useBasicOperation";
import { BasicStudentForm, type StudentInput } from "./BasicStudentForm";
import { BasicHistory, BasicPaymentForm, BasicReceipt, useBasicFormat } from "./BasicFees";
import { BasicSeatMap } from "./BasicSeats";
import { BasicSetup } from "./BasicSetup";
import { BasicStudentStatus } from "./BasicStudentStatus";
import { BasicAdmissionReview } from "./BasicAdmissionReview";
import "@/styles/basic-product.css";
import { useBasicNavigationGuard } from "./useBasicNavigationGuard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const areas: { key: string; label: string; capability: BranchCapabilityKey; icon: typeof House }[] = [
    { key: "", label: "Overview", capability: "basicOverview", icon: House },
    { key: "students", label: "Students", capability: "studentsView", icon: Users },
    { key: "seats", label: "Seats", capability: "seatsView", icon: Armchair },
    { key: "fees", label: "Fees", capability: "paymentsView", icon: IndianRupee },
];
type Modal = { kind: "student"; id?: string } | { kind: "status"; id: string; status: "ACTIVE" | "INACTIVE" } | { kind: "admission-review"; matches: StudentListItem[] } | { kind: "payment"; id: string } | { kind: "receipt"; receipt: FeeCollectionView } | null;
export function BasicWorkspace({ access, blocked = false, onInteractionState, importContent }: { access: BranchAccess; blocked?: boolean; onInteractionState?: (state: { dirty: boolean; pending: boolean }) => void; importContent?: ReactNode }) {
    const t = useTranslation(), { money, date } = useBasicFormat(), { ownerKey } = useUserPreferences();
    const compactLayout = useMediaQuery("(max-width: 1023px)");
    const [navigationOpen, setNavigationOpen] = useState(false);
    const pathname = usePathname(), router = useRouter(), root = "/branch/" + access.branchId;
    useEffect(() => { queueMicrotask(() => setNavigationOpen(false)); }, [pathname]);
    const scope = encodeURIComponent(ownerKey) + ":" + access.branchId;
    const rawArea = pathname.split("/")[3] ?? "";
    const area = rawArea === "onboarding" && pathname.split("/")[4] === "import" ? "imports" : rawArea === "payments" ? "fees" : ["settings","shifts"].includes(rawArea) ? "setup" : rawArea === "allocations" ? "seats" : rawArea;
    const studentId = area === "students" ? pathname.split("/")[4] : undefined;
    const [data,setData] = useState<BasicData | null>(null), [loading,setLoading] = useState(true), [error,setError] = useState("");
    const [revision,setRevision] = useState(0), [modal,setModal] = useState<Modal>(null), [query,setQuery] = useState(""), [limit,setLimit] = useState(50);
    const [shift,setShift] = useState(""), [selectedStudent,setSelectedStudent] = useState(""), [seat,setSeat] = useState(""), [source,setSource] = useState("");
    const [availability,setAvailability]=useState<{available:number;total:number;shift:string}|null>(null);
    const [notice,setNotice] = useState(""), [dirty,setDirty] = useState(false);
    const [confirmation, setConfirmation] = useState<{ scope: string; pathname: string; operationKey: string | null; description: string; action: () => void } | null>(null);
    const [navigationNotice, setNavigationNotice] = useState(false);
    const dirtyRef = useRef(false);
    const markDirty = () => { dirtyRef.current = true; setDirty(true); };
    const clean = useCallback(() => { dirtyRef.current = false; setDirty(false); }, []);
    const confirmed = useCallback(() => { clean(); setRevision(v=>v+1); }, [clean]);
    const operation = useBasicOperation(scope, confirmed);
    const can = (capability: BranchCapabilityKey) => !blocked && hasBranchCapability(access,capability);
    const disabled = operation.pending || !!operation.saved || blocked;
    const selected = data?.allocationStudents.find(s=>s.id===selectedStudent);
    const currentStudent = data?.students.find(s=>s.id===studentId);
    const sourceAllocation = activeAllocations(selected).find(a=>a.id===source);
    const sourceRows = sourceAllocation ? activeAllocations(selected).filter(a=>a.id===source || (sourceAllocation.multiShiftId && a.multiShiftId===sourceAllocation.multiShiftId && a.seatId===sourceAllocation.seatId)) : [];
    const activeShift = shift || data?.shifts.find(s=>s.status==="ACTIVE")?.id || "";
    const sourceIds = sourceRows.map(a=>a.id).join(",");
    const feeRows = data?.payments ?? [];
    const studentFees = (id: string) => feeRows.filter(p=>p.studentId===id);
    const balance = (id: string) => studentFees(id).reduce((sum,p)=>sum+remainingFee(p),0);

    useEffect(() => {
        let current = true;
        queueMicrotask(()=>{if(current){setLoading(true);setError("");}});
        loadBasicData(access).then(value => { if(current) setData(value); }).catch(cause => { if(current) { setData(null); setError(cause instanceof Error ? cause.message : "Unable to load this workspace."); } }).finally(()=>{if(current)setLoading(false);});
        return ()=>{ current=false; };
    }, [access,revision]);
    if (confirmation && (confirmation.scope !== scope || confirmation.pathname !== pathname)) setConfirmation(null);
    function requestConfirmation(description: string, action: () => void) {
        setConfirmation(current => current?.scope === scope && current.pathname === pathname ? current : {
            scope, pathname, operationKey: operation.saved?.key ?? null, description, action,
        });
    }
    function allowNavigation(resume: () => void) {
        if (operation.pending) { setNavigationNotice(true); return false; }
        if (dirtyRef.current) {
            requestConfirmation("Leave with unsaved changes? Your student draft is saved for this branch.", () => { setModal(null); resume(); });
            return false;
        }
        clean();
        return true;
    }
    useBasicNavigationGuard(allowNavigation, dirty || operation.pending);
    useEffect(()=>{onInteractionState?.({dirty:dirty || !!operation.saved,pending:operation.pending});},[dirty,operation.saved,operation.pending,onInteractionState]);
    function go(path: string) {
        const navigate = () => { setModal(null); setQuery(""); setLimit(50); router.push(path); };
        if (allowNavigation(navigate)) navigate();
    }
    function close() {
        if (operation.pending) return;
        if (dirtyRef.current) { requestConfirmation("Close with unsaved changes?", () => setModal(null)); return; }
        clean(); setModal(null);
    }
    function confirmRequestedAction() {
        if (!confirmation || confirmation.scope !== scope || confirmation.pathname !== pathname || operation.pending || blocked) return;
        setConfirmation(null);
        // A refreshed/replaced recovery request must never be cleared by an old prompt.
        if (confirmation.operationKey !== (operation.saved?.key ?? null)) return;
        clean();
        confirmation.action();
    }
    async function saveStudent(input: StudentInput, chooseSeat: boolean) {
        if(!can("studentsManage") || disabled) return;
        const id = modal?.kind==="student" ? modal.id : undefined;
        const result = await operation.run<StudentListItem>(operation.command(id ? "edit" : "student", "/branches/"+access.branchId+"/students",id ? "PATCH":"POST",{...(id?{id}:{}),...input}));
        if(!result) return;
        sessionStorage.removeItem("basic-student-draft:v1:"+scope+":"+(id??"new"));
        setModal(null); setNotice(t.owned("Student details saved."));
        if(chooseSeat && can("allocationsManage")) {setSelectedStudent(result.id);setSource("");setSeat("");go(root+"/seats");}
        else go(root+"/students/"+result.id);
    }
    async function changeStatus() {
        if(modal?.kind!=="status" || !can("studentsManage") || disabled) return;
        setNotice("");
        const result=await operation.run<StudentListItem>(operation.command("status","/branches/"+access.branchId+"/students","PATCH",{id:modal.id,status:modal.status,dueResolution:"KEEP"}));
        if(result) { setModal(null);setNotice(t.owned(result.status==="INACTIVE" ? "Student marked inactive. Existing fees and history are unchanged." : "Student reactivated. Choose an available seat and shift.")); }
    }
    function finishAdmissionReview() {
        requestConfirmation("Close recovery without confirming this admission? Your draft stays saved. Review existing records before submitting it again.", () => {
            operation.clear(); setModal(null); setNotice("");
        });
    }
    async function recordPayment(amount: number, method: "CASH"|"UPI"|"BANK_TRANSFER", ids: string[]) {
        if(!can("paymentsRecord") || disabled || modal?.kind!=="payment") return;
        const command=operation.command("payment","/branches/"+access.branchId+"/collections","POST",{studentId:modal.id,paymentIds:ids,amount,method,reference:"",note:""});
        command.body.idempotencyKey=command.key;
        const receipt=await operation.run<FeeCollectionView>(command);
        if(receipt) setModal({kind:"receipt",receipt});
    }
    function chooseStudent(id: string) { setSelectedStudent(id);setSource("");setSeat("");clean(); }
    function chooseSource(id: string) {
        setSource(id);setSeat(""); const row=activeAllocations(selected).find(a=>a.id===id); if(row)setShift(row.shiftId); clean();
    }
    async function assign() {
        if(!selected || !seat || !activeShift || !can("allocationsManage") || disabled) return;
        const moving=sourceRows.length>0;
        const body={branchId:access.branchId,studentId:selected.id,seatId:seat,shiftIds:sourceAllocation?.multiShiftId ? sourceRows.map(a=>a.shiftId):[activeShift],
            ...(moving?{allocationIds:sourceRows.map(a=>a.id)}:{}),...(sourceAllocation?.multiShiftId?{multiShiftId:sourceAllocation.multiShiftId}:{})};
        const result=await operation.run(operation.command(moving?"move":"assign",moving?"/seat-allocations/"+sourceRows[0].id:"/branches/"+access.branchId+"/seat-allocations",moving?"PATCH":"POST",body));
        if(result) {setNotice(t.owned("Seat assignment confirmed."));setSeat("");setSource("");}
    }
    async function recover() {
        const command=operation.saved;
        if(!command || operation.pending || blocked) return;
        if(command.kind==="payment") {
            try {
                const receipt=await basicRequest<FeeCollectionView|null>(command.url+"?recoveryKey="+encodeURIComponent(command.key));
                if(receipt) {operation.clear();confirmed();setModal({kind:"receipt",receipt});return;}
                if(!can("paymentsRecord")) {operation.setError("No receipt was found. Recording is unavailable with current access.");return;}
            } catch(cause) {operation.setError(cause instanceof Error?cause.message:"Unable to check the saved payment.");return;}
        }
        if(command.kind==="payment" || command.kind==="move") {
            const result=await operation.run<FeeCollectionView>(command);
            if(result && command.kind==="payment") setModal({kind:"receipt",receipt:result});
            else if(result) {setModal(null);setNotice(t.owned("Saved operation confirmed. Current records have been refreshed."));}
            return;
        }
        // Non-command legacy services are never blindly re-posted. Resolve their actual
        // committed records first; a new action requires an explicit owner review.
        try {
            const latest=await loadBasicData(access), body=command.body;
            let found=false;
            const expectedName=validateRequiredText(body.name,"Student name"), expectedPhone=validatePhone(body.phone);
            const phoneMatches=(phone:string|null)=>{const actual=validatePhone(phone);return actual.ok&&expectedPhone.ok&&actual.value===expectedPhone.value;};
            if(command.kind==="student") {
                // This legacy admission endpoint has no operation receipt. Never infer
                // success from an older matching profile, even if every fee also matches.
                const matches=latest.students.filter(s=>expectedName.ok && s.name.toLocaleLowerCase()===expectedName.value.toLocaleLowerCase() && phoneMatches(s.phone));
                setData(latest);setNotice("");setModal({kind:"admission-review",matches});return;
            }
            if(command.kind==="status") found=latest.students.some(s=>s.id===body.id && s.status===body.status && (body.status!=="INACTIVE" || activeAllocations(s).length===0));
            if(command.kind==="edit") found=latest.students.some(s=>s.id===body.id && expectedName.ok && s.name===expectedName.value && (body.phone===undefined || phoneMatches(s.phone)) && (body.monthlyFee===undefined || s.monthlyFee===body.monthlyFee));
            if(command.kind==="assign") found=activeAllocations(latest.allocationStudents.find(s=>s.id===body.studentId)).some(a=>a.seatId===body.seatId && Array.isArray(body.shiftIds) && body.shiftIds.includes(a.shiftId));
            if(command.kind==="setup") {
                if(command.url==="/branches/"+access.branchId) found=Object.entries(body).every(([key,value])=>(latest.branch as unknown as Record<string,unknown>)[key]===value);
                else if(command.url.includes("/shifts")) found=latest.shifts.some(s=>Object.entries(body).every(([key,value])=>(s as unknown as Record<string,unknown>)[key]===value));
            }
            setData(latest);
            if(found) { if(command.kind==="edit")sessionStorage.removeItem("basic-student-draft:v1:"+scope+":"+String(body.id)); operation.clear();clean();setModal(null);setNotice(t.owned("Saved operation confirmed. Current records have been refreshed.")); }
            else operation.setError("The result is not confirmed. Review the current records before starting another operation.");
        } catch(cause) { operation.setError(cause instanceof Error?cause.message:"Unable to check the saved operation."); }
    }
    const visibleAreas = areas.filter(a => hasBranchCapability(access, a.capability));
    const navigation = visibleAreas.map(({key,label,icon}) => <SidebarItem key={key} icon={icon} label={label} href={root+(key?"/"+key:"")} isActive={area===key} density="compact" />);
    const sidebar = <SidebarFrame homeHref={root} label="Branch navigation">
        {navigation}
        <div className="ui-navigation-secondary">
            {can("importView") && <SidebarItem icon={UploadCloud} label="Import students" href={root+"/onboarding/import"} isActive={area === "imports"} density="compact" />}
            {access.permissions.manage_branch && <SidebarItem icon={Settings} label="Library setup" href={root+"/setup"} isActive={area === "setup"} density="compact" />}
            {access.isOwner && <SidebarItem icon={ArrowLeft} label="Back to organization" href={"/org/"+access.organizationId} isActive={false} density="compact" />}
        </div>
    </SidebarFrame>;
    const pageCapability=area==="setup"?"settingsManage":areas.find(a=>a.key===area)?.capability??({whatsapp:"whatsappView",staff:"staffView",analytics:"analyticsView",attendance:"attendanceView",imports:"importView"} as Record<string,BranchCapabilityKey>)[area]??"fullWorkspace";
    const blockedPageReason=getBranchCapabilityDecision(access,pageCapability).reason??"This feature requires the Standard plan.";
    const pageAllowed=area==="imports" ? hasBranchCapability(access,"importView") : area==="setup" ? access.permissions.manage_branch : areas.some(a=>a.key===area && hasBranchCapability(access,a.capability));
    const roster=(data?.students??[]).filter(s=>(s.name+" "+(s.phone??"")).toLowerCase().includes(query.toLowerCase()));
    const feeStudents=[...new Map(feeRows.map(p=>[p.studentId,{id:p.studentId,name:p.student?.name??data?.students.find(s=>s.id===p.studentId)?.name??t("Student")}])).values()].filter(s=>s.name.toLowerCase().includes(query.toLowerCase()));
    const modalStudent=modal?.kind==="student"?data?.students.find(s=>s.id===modal.id):undefined;
    const paymentStudent=modal?.kind==="payment"?data?.students.find(s=>s.id===modal.id):undefined;
    return <div className="bp-prototype" data-basic-workspace><RouteTitleUpdater />
        <a href="#bp-main" className="bp-skip">{t.owned("Skip to content")}</a>
        <div className="bp-app">
        {!compactLayout && <div className="ui-basic-navigation">{sidebar}</div>}
        {compactLayout && <Drawer open={navigationOpen} onClose={()=>setNavigationOpen(false)} title={t("Branch navigation")} closeLabel={t("Close navigation")} variant="navigation" className="max-w-[19rem]"><div className="h-full">{sidebar}</div></Drawer>}
        <div className="bp-workspace">
            <header className="bp-topbar"><button type="button" className="ui-basic-menu" onClick={()=>setNavigationOpen(true)} aria-label={t("Open navigation")} aria-expanded={navigationOpen}><Menu size={20}/></button><WorkspaceSwitcher wrapBranchName/></header>
            <main id="bp-main" tabIndex={-1} aria-busy={loading || operation.pending}>
                {access.billingExperience?.accessMode==="READ_ONLY" && <p className="bp-warning" role="status">{t.owned("Records are read-only. Open Account billing to restore access.")}</p>}
                {navigationNotice && operation.pending && <p role="status" className="bp-warning">{t.owned("Wait for the current operation to finish.")}</p>}
                {notice && <p role="status" className="bp-notice"><Check size={17}/>{notice}</p>}
                {operation.saved && !operation.pending && <section role="alert" className="bp-recovery"><strong>{t.owned("An operation needs confirmation")}</strong><p>{t.error(operation.error || "Check the saved operation before making another change.")}</p><button className="bp-button bp-button-secondary" disabled={blocked} onClick={()=>void recover()}>{t.owned("Check saved operation")}</button>
                    {!["payment","move","student"].includes(operation.saved.kind) && <button className="bp-text-button" onClick={()=>requestConfirmation("Have you reviewed the current records? Clearing recovery does not undo an operation.", () => { operation.clear(); setModal(null); })}>{t.owned("I reviewed the records")}</button>}
                </section>}
                {operation.error && !operation.saved && <p className="bp-error" role="alert">{t.error(operation.error)}</p>}
                {!pageAllowed ? <div className="bp-empty"><h1>{t.owned(blockedPageReason)}</h1><Link className="bp-button" href={root}>{t.owned("Back to overview")}</Link></div>
                : loading && !data ? <p role="status" className="bp-empty">{t.owned("Loading workspace")}</p>
                : error ? <div className="bp-empty" role="alert"><p>{t.error(error)}</p><button className="bp-button" onClick={()=>setRevision(v=>v+1)}>{t("Retry")}</button></div>
                : data && <>
                    {area==="imports" && <div data-app-design-pilot="workspace" className="min-w-0">{importContent}</div>}
                    {area==="" && <><div className="bp-page-heading"><div><p className="bp-eyebrow">{t.owned("A LITTLE MORE ORGANISED, EVERY DAY")}</p><h1>{t.owned("Your library overview")}</h1></div><span className="bp-date">{date(data.summary.today+"T12:00:00",{month:"long",year:"numeric"})}</span></div>
                        <div className="bp-metrics">{can("seatsView")&&<div><span><Armchair size={24}/></span><dl><dt>{t.owned("Available seats")} · {data.shifts.find(s=>s.id===activeShift)?.name}</dt><dd>{availability?.shift===activeShift?availability.available:"—"} <small>/ {availability?.shift===activeShift?availability.total:"—"}</small></dd></dl></div>}{data.summary.activeStudents!==null&&<div><span><Users size={24}/></span><dl><dt>{t("Active students")}</dt><dd>{data.summary.activeStudents}</dd></dl></div>}{data.summary.money&&<div><span><IndianRupee size={24}/></span><dl><dt>{t.owned("Fees collected this month")}</dt><dd>{money(data.summary.money.collectedThisMonth)}</dd></dl></div>}</div>
                        {can("seatsView")&&<BasicSeatMap onAvailability={setAvailability} branchId={access.branchId} shifts={data.shifts} shiftId={activeShift} selected="" sourceIds="" revision={revision} onShift={setShift} onSeat={id=>{setSeat(id);go(root+"/seats");}}/>}
                    </>}
                    {area==="students" && !studentId && <>
                        <div className="bp-page-heading"><div><h1>{t.owned("Your students")}</h1><p>{data.students.length} {t("Students")}</p></div><div className="flex flex-wrap gap-2">{can("importView") && <Link className="bp-button bp-button-secondary" href={root+"/onboarding/import"}><UploadCloud size={18}/>{t.owned("Import students")}</Link>}<button className="bp-button bp-button-primary" disabled={disabled||!can("studentsManage")} onClick={()=>setModal({kind:"student"})}><Plus size={18}/>{t("Add student")}</button></div></div>
                        <div className="bp-list-panel"><label className="bp-search"><Search size={19}/><input aria-label={t.owned("Search students")} placeholder={t.owned("Find a student by name or phone")} value={query} onChange={e=>{setQuery(e.target.value);setLimit(50);}}/></label>
                            {roster.slice(0,limit).map(s=><button className="bp-student-row" key={s.id} onClick={()=>go(root+"/students/"+s.id)}><span className="bp-person"><span className="bp-avatar">{initials(s.name)}</span><span><strong>{s.name}</strong><small className="bp-person-meta"><span className="bp-phone">{s.phone??t.owned("No mobile number")}</span><span>{t.owned(s.status)}</span></small></span></span><span className="bp-roster-seat">{activeAllocations(s).map(a=><small key={a.id}>{a.seat.label} · {a.shift.name}</small>)}{!activeAllocations(s).length&&t.owned("Choose a seat")}</span>{can("paymentsView")&&<span className={"bp-fee-status "+(!balance(s.id)?"is-paid":"")}>{balance(s.id)?money(balance(s.id))+" "+t("Due"):t.owned("No outstanding dues")}</span>}<ChevronRight className="bp-row-chevron" size={18} aria-hidden="true"/></button>)}
                            {!roster.length&&<div className="bp-empty"><Users size={28}/><h2>{t.owned("No students found")}</h2><p>{t.owned("Try another name or add a student.")}</p></div>}
                            {roster.length>limit&&<button className="bp-button" onClick={()=>setLimit(v=>v+50)}>{t("Load more")}</button>}
                        </div>
                    </>}
                    {area==="students"&&studentId&&(currentStudent?<>
                        <button className="bp-back" onClick={()=>go(root+"/students")}><ArrowLeft size={17}/>{t("All students")}</button>
                        <div className="bp-student-heading"><span className="bp-avatar bp-avatar-large">{initials(currentStudent.name)}</span><div className="bp-student-heading-identity"><h1>{currentStudent.name}</h1><p className="bp-person-meta"><span className="bp-phone">{currentStudent.phone??t.owned("No mobile number")}</span><span>{t.owned(currentStudent.status)}</span></p></div><div className="bp-student-heading-actions"><button className="bp-button bp-button-quiet" disabled={disabled||!can("studentsManage")} onClick={()=>setModal({kind:"student",id:currentStudent.id})}>{t.owned("Edit details")}</button><button className="bp-button bp-button-secondary" disabled={disabled||!can("studentsManage")} onClick={()=>{setNotice("");setModal({kind:"status",id:currentStudent.id,status:currentStudent.status==="ACTIVE"?"INACTIVE":"ACTIVE"});}}>{t.owned(currentStudent.status==="ACTIVE"?"Mark inactive":"Reactivate student")}</button></div></div>
                        <div className="bp-detail-grid">{can("seatsView")&&<section className="bp-detail-card"><Armchair size={23}/><h2>{t("Seats")}</h2>{activeAllocations(currentStudent).map(a=><p key={a.id}>{a.seat.label} · {a.shift.name}{a.multiShift?" · "+a.multiShift.name:""}</p>)}{!activeAllocations(currentStudent).length&&<p>{t.owned(currentStudent.status==="ACTIVE"?"Choose a shift and an available seat.":"Reactivate this student before assigning a seat.")}</p>}<button className="bp-button bp-button-secondary" disabled={disabled||!can("allocationsManage")||currentStudent.status!=="ACTIVE"} onClick={()=>{chooseStudent(currentStudent.id);go(root+"/seats");}}>{t.owned("Choose or change a seat")}<ArrowRight size={17}/></button></section>}
                        {can("paymentsView")&&<section className="bp-detail-card"><IndianRupee size={23}/><h2>{money(balance(currentStudent.id))} {t("Due")}</h2><p>{t("Monthly fee")}: {money(currentStudent.monthlyFee)}</p><p>{t.owned("Monthly fees start one month after joining. Changes apply to future dues.")}</p><button className="bp-button bp-button-primary" disabled={disabled||!can("paymentsRecord")||!balance(currentStudent.id)} onClick={()=>setModal({kind:"payment",id:currentStudent.id})}>{t.owned("Record payment")}</button></section>}</div>
                        {can("paymentsView")&&<><FeeDetails fees={studentFees(currentStudent.id)}/><BasicHistory key={currentStudent.id} branchId={access.branchId} studentId={currentStudent.id} revision={revision} onReceipt={receipt=>setModal({kind:"receipt",receipt})}/></>}
                    </>:<div className="bp-empty">{t.owned("Student not found")}</div>)}
                    {area==="seats"&&<><div className="bp-page-heading"><div><h1>{t.owned("A place to settle in")}</h1><p>{t.owned("Pick a shift, choose a seat, and make it theirs.")}</p></div></div>
                        <div className="bp-allocation-layout"><BasicSeatMap onAvailability={setAvailability} branchId={access.branchId} shifts={data.shifts} shiftId={activeShift} multiShiftId={sourceAllocation?.multiShiftId??undefined} selected={seat} sourceIds={sourceIds} revision={revision} onShift={id=>{if(!sourceAllocation?.multiShiftId){setShift(id);setSeat("");}}} onSeat={id=>{setSeat(id);markDirty();}}/>
                        <aside className="bp-assignment" aria-label={t.owned("Seat assignment")}><h2>{t.owned("Assign a seat")}</h2>
                            <label>{t("Student")}<select aria-label={t("Student")} value={selectedStudent} disabled={disabled||!can("allocationsManage")} onChange={e=>chooseStudent(e.target.value)}><option value="">{t.owned("Choose a student")}</option>{data.allocationStudents.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                            {selected&&activeAllocations(selected).length>0&&<label>{t.owned("Allocation to change")}<select aria-label={t.owned("Allocation to change")} value={source} disabled={disabled} onChange={e=>chooseSource(e.target.value)}><option value="">{t.owned("Add another shift; keep existing seats")}</option>{activeAllocations(selected).filter((a,i,all)=>!a.multiShiftId||all.findIndex(b=>b.multiShiftId===a.multiShiftId&&b.seatId===a.seatId)===i).map(a=><option key={a.id} value={a.id}>{a.seat.label} · {a.multiShift?.name??a.shift.name}</option>)}</select></label>}
                            {sourceAllocation?.multiShiftId&&<p className="bp-subtle">{t.owned("This change keeps every shift in the existing allocation together.")}</p>}
                            <div className="bp-chosen-seat"><Armchair size={32}/><strong>{seat?t.owned("Seat selected"):t.owned("Pick a seat")}</strong><span>{data.shifts.find(s=>s.id===activeShift)?.name}</span></div>
                            <button className="bp-button bp-button-primary" disabled={disabled||!can("allocationsManage")||!seat||!selected} onClick={()=>void assign()}>{t.owned(source?"Change seat":"Assign seat")}<Check size={17}/></button>
                            {selected&&can("paymentsView")&&can("studentsView")&&<button className="bp-text-button" onClick={()=>go(root+"/students/"+selected.id)}>{t.owned("Review student fees")}<ArrowRight size={17}/></button>}
                        </aside></div>
                    </>}
                    {area==="fees"&&<><div className="bp-page-heading"><div><h1>{t.owned("Student fees")}</h1><p>{t.owned("A clear view of what’s paid and what’s left.")}</p></div><button className="bp-button bp-button-secondary" disabled={disabled||!can("paymentsGenerate")} onClick={async()=>{const result=await operation.run(operation.command("setup","/branches/"+access.branchId+"/payments/generate","POST",{}));if(result)setNotice(t.owned("Due fees refreshed."));}}>{t.owned("Refresh due fees")}</button></div>
                        <div className="bp-fee-summary"><div><span>{t.owned("Left to collect")}</span><strong>{money(feeRows.reduce((sum,p)=>sum+remainingFee(p),0))}</strong></div><div><span>{t.owned("Received this month")}</span><strong>{money(data.summary.money?.collectedThisMonth??0)}</strong></div></div>
                        <div className="bp-list-panel"><label className="bp-search"><Search size={18}/><input aria-label={t.owned("Search fees")} placeholder={t.owned("Find a student")} value={query} onChange={e=>{setQuery(e.target.value);setLimit(50);}}/></label>
                            {feeStudents.slice(0,limit).map(s=><div className="bp-fee-row" key={s.id}><span className="bp-person"><span className="bp-avatar">{initials(s.name)}</span><strong>{s.name}</strong></span><div className="bp-fee-amount"><strong>{money(balance(s.id))}</strong><small>{t("Remaining due")}</small></div><button className="bp-button bp-button-secondary" disabled={disabled||!can("paymentsRecord")||!balance(s.id)} onClick={()=>setModal({kind:"payment",id:s.id})}>{t.owned("Record payment")}</button></div>)}
                            {!feeStudents.length&&<p className="bp-empty">{t.owned("No student fees are waiting for payment.")}</p>}{feeStudents.length>limit&&<button className="bp-button" onClick={()=>setLimit(v=>v+50)}>{t("Load more")}</button>}
                        </div><FeeDetails fees={feeRows}/><BasicHistory branchId={access.branchId} revision={revision} onReceipt={receipt=>setModal({kind:"receipt",receipt})}/>
                    </>}
                    {area==="setup"&&<BasicSetup key={revision} data={data} disabled={disabled||!can("settingsManage")} onDirty={markDirty} onSave={async(url,method,body)=>{if(!can("settingsManage")||disabled)return;const result=await operation.run(operation.command("setup",url,method,body));if(result)setNotice(t.owned("Library setup saved."));}}/>}
                </>}
            </main>
        </div></div>
        <nav className="bp-mobile-nav" aria-label={t.owned("Main navigation")}>{visibleAreas.map(({key,label,icon:Icon})=><Link key={key} href={root+(key?"/"+key:"")} aria-current={area===key?"page":undefined}><Icon size={20}/><span>{t.owned(label)}</span></Link>)}</nav>
        {modal?.kind==="student"&&data&&<BasicStudentForm key={modal.id??"new"} student={modalStudent} defaultFee={data.branch.defaultFee??0} admissionFee={data.branch.defaultAdmissionFee??0} pending={operation.pending} locked={!!operation.saved||!can("studentsManage")} error={operation.error} onSave={(input,next)=>void saveStudent(input,next)} onRecover={operation.saved?()=>void recover():undefined} onClose={close} scope={scope} onDirty={markDirty}/>}
        {modal?.kind==="payment"&&<BasicPaymentForm key={modal.id} name={paymentStudent?.name??feeStudents.find(s=>s.id===modal.id)?.name??t("Student")} fees={studentFees(modal.id)} pending={operation.pending} locked={!!operation.saved||!can("paymentsRecord")} error={operation.error} onRecord={(amount,method,ids)=>void recordPayment(amount,method,ids)} onRecover={operation.saved?()=>void recover():undefined} onClose={close} onDirty={markDirty}/>}
        {modal?.kind==="status"&&data&&<BasicStudentStatus name={data.students.find(s=>s.id===modal.id)?.name??t("Student")} status={modal.status} pending={operation.pending} locked={!!operation.saved||!can("studentsManage")} error={operation.error} onConfirm={()=>void changeStatus()} onRecover={operation.saved?()=>void recover():undefined} onClose={close}/>}
        {modal?.kind==="admission-review"&&operation.saved?.kind==="student"&&<BasicAdmissionReview command={operation.saved} matches={modal.matches} onRecord={id=>go(root+"/students/"+id)} onFinish={finishAdmissionReview} onClose={()=>setModal(null)}/>}
        {modal?.kind==="receipt"&&<BasicReceipt branchId={access.branchId} receipt={modal.receipt} onClose={()=>setModal(null)}/>}
        <ConfirmDialog isOpen={!!confirmation && confirmation.scope === scope && confirmation.pathname === pathname}
            title={operation.saved ? "An operation needs confirmation" : "Unsaved changes"}
            description={confirmation?.description ?? ""} confirmText="Continue" variant="warning"
            loading={operation.pending || blocked} onClose={() => setConfirmation(null)} onConfirm={confirmRequestedAction}
            overlayClassName="app-design-pilot-overlay bp-prototype bp-modal-overlay" className="bp-modal-card" />
        {dirty&&<span className="bp-sr-only" role="status">{t.owned("Unsaved changes")}</span>}
    </div>;
}
function FeeDetails({fees}:{fees:BasicData["payments"]}) {
    const t=useTranslation(),{money,feeDate:date}=useBasicFormat();
    return <details className="bp-fee-details"><summary>{t.owned("Fee balances and waivers")}</summary>{fees.map(p=><div key={p.id}><strong>{p.student?.name} · {t.owned(p.type==="ADMISSION"?"Admission fee":"Monthly fee")}</strong><p>{t("Due date")}: {date(p.dueDate)}{p.periodStart&&p.periodEnd&&<> · {t("Fee period")}: {date(p.periodStart)} – {date(p.periodEnd)}</>}</p><div className="ui-fee-state"><span>{t.owned(p.status)}</span>{p.status==="DUE"&&p.collectedAmount>0&&<span>{t("Partially paid")}</span>}{p.status==="DUE"&&remainingFee(p)>0&&isOverdue(p.dueDate)&&<span>{t("Overdue")}</span>}</div><p>{t.owned("Billed")}: {money(p.amount)} · {t("Paid")}: {money(p.ledgerBacked?p.collectedAmount:p.status==="PAID"?p.amount:0)} · {t("Waived")}: {money(p.ledgerBacked?p.waivedAmount:p.status==="WAIVED"?p.amount:0)} · {t("Remaining due")}: {money(remainingFee(p))}</p></div>)}</details>;
}
