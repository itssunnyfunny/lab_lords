"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Armchair, ArrowLeft, ArrowRight, Check, ChevronRight, House, IndianRupee, Plus, Search, Settings, UserRound, Users } from "lucide-react";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { LanguageControls } from "@/components/settings/LanguageControls";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { useTranslation } from "@/components/settings/LocalizedText";
import { getBranchCapabilityDecision, hasBranchCapability, type BranchCapabilityKey } from "@/lib/branchCapabilities";
import { validatePhone, validateRequiredText } from "@/lib/formValidation";
import type { BranchAccess } from "@/types";
import type { StudentListItem } from "@/lib/api/students";
import type { FeeCollectionView } from "@/lib/feeCollections";
import { remainingFee } from "@/lib/feeBalance";
import { activeAllocations, initials, loadBasicData, type BasicData } from "./data";
import { basicRequest, useBasicOperation } from "./useBasicOperation";
import { BasicStudentForm, type StudentInput } from "./BasicStudentForm";
import { BasicHistory, BasicPaymentForm, BasicReceipt, useBasicFormat } from "./BasicFees";
import { BasicSeatMap } from "./BasicSeats";
import { BasicSetup } from "./BasicSetup";
import "@/styles/basic-product.css";
import { useBasicNavigationGuard } from "./useBasicNavigationGuard";

const areas: { key: string; label: string; capability: BranchCapabilityKey; icon: typeof House }[] = [
    { key: "", label: "Overview", capability: "basicOverview", icon: House },
    { key: "students", label: "Students", capability: "studentsView", icon: Users },
    { key: "seats", label: "Seats", capability: "seatsView", icon: Armchair },
    { key: "fees", label: "Fees", capability: "paymentsView", icon: IndianRupee },
];
type Modal = { kind: "student"; id?: string } | { kind: "payment"; id: string } | { kind: "receipt"; receipt: FeeCollectionView } | null;
export function BasicWorkspace({ access, blocked = false, onInteractionState }: { access: BranchAccess; blocked?: boolean; onInteractionState?: (state: { dirty: boolean; pending: boolean }) => void }) {
    const t = useTranslation(), { money, date } = useBasicFormat(), { ownerKey, profileName } = useUserPreferences();
    const pathname = usePathname(), router = useRouter(), root = "/branch/" + access.branchId;
    const scope = encodeURIComponent(ownerKey) + ":" + access.branchId;
    const rawArea = pathname.split("/")[3] ?? "";
    const area = rawArea === "payments" ? "fees" : ["settings","shifts"].includes(rawArea) ? "setup" : rawArea === "allocations" ? "seats" : rawArea;
    const studentId = area === "students" ? pathname.split("/")[4] : undefined;
    const [data,setData] = useState<BasicData | null>(null), [loading,setLoading] = useState(true), [error,setError] = useState("");
    const [revision,setRevision] = useState(0), [modal,setModal] = useState<Modal>(null), [query,setQuery] = useState(""), [limit,setLimit] = useState(50);
    const [shift,setShift] = useState(""), [selectedStudent,setSelectedStudent] = useState(""), [seat,setSeat] = useState(""), [source,setSource] = useState("");
    const [availability,setAvailability]=useState<{available:number;total:number;shift:string}|null>(null);
    const [notice,setNotice] = useState(""), [dirty,setDirty] = useState(false);
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
    function allowNavigation() {
        if(operation.pending) { window.alert(t.owned("Wait for the current operation to finish.")); return false; }
        if(dirtyRef.current && !window.confirm(t.owned("Leave with unsaved changes? Your student draft is saved for this branch."))) return false;
        clean(); return true;
    }
    const navigationRef = useRef(allowNavigation);
    useEffect(()=>{navigationRef.current=allowNavigation;});
    useBasicNavigationGuard(allowNavigation, dirty || operation.pending);
    useEffect(()=>{onInteractionState?.({dirty:dirty || !!operation.saved,pending:operation.pending});},[dirty,operation.saved,operation.pending,onInteractionState]);
    function go(path: string) { if(allowNavigation()) {setModal(null);setQuery("");setLimit(50);router.push(path);} }
    function close() { if(operation.pending) return; if(dirtyRef.current && !window.confirm(t.owned("Close with unsaved changes?"))) return; clean();setModal(null); }
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
            if(command.kind==="student") found=latest.students.some(s=>expectedName.ok && s.name===expectedName.value && phoneMatches(s.phone) && (body.monthlyFee===undefined || s.monthlyFee===body.monthlyFee));
            if(command.kind==="edit") found=latest.students.some(s=>s.id===body.id && expectedName.ok && s.name===expectedName.value && (body.phone===undefined || phoneMatches(s.phone)) && (body.monthlyFee===undefined || s.monthlyFee===body.monthlyFee));
            if(command.kind==="assign") found=activeAllocations(latest.allocationStudents.find(s=>s.id===body.studentId)).some(a=>a.seatId===body.seatId && Array.isArray(body.shiftIds) && body.shiftIds.includes(a.shiftId));
            if(command.kind==="setup") {
                if(command.url==="/branches/"+access.branchId) found=Object.entries(body).every(([key,value])=>(latest.branch as unknown as Record<string,unknown>)[key]===value);
                else if(command.url.includes("/shifts")) found=latest.shifts.some(s=>Object.entries(body).every(([key,value])=>(s as unknown as Record<string,unknown>)[key]===value));
            }
            setData(latest);
            if(found) { if(command.kind==="student"||command.kind==="edit")sessionStorage.removeItem("basic-student-draft:v1:"+scope+":"+(command.kind==="edit"?String(body.id):"new")); operation.clear();clean();setModal(null);setNotice(t.owned("Saved operation confirmed. Current records have been refreshed.")); }
            else operation.setError("The result is not confirmed. Review the current records before starting another operation.");
        } catch(cause) { operation.setError(cause instanceof Error?cause.message:"Unable to check the saved operation."); }
    }
    const navigation = areas.filter(a=>hasBranchCapability(access,a.capability)).map(({key,label,icon:Icon})=><Link key={key} href={root+(key?"/"+key:"")} aria-current={area===key?"page":undefined}><Icon size={20} strokeWidth={1.7}/><span>{t.owned(label)}</span></Link>);
    const orgRoot="/org/"+access.organizationId;
    const pageCapability=area==="setup"?"settingsManage":areas.find(a=>a.key===area)?.capability??({whatsapp:"whatsappView",staff:"staffView",analytics:"analyticsView",attendance:"attendanceView",imports:"importView"} as Record<string,BranchCapabilityKey>)[area]??"fullWorkspace";
    const blockedPageReason=getBranchCapabilityDecision(access,pageCapability).reason??"This feature requires the Standard plan.";
    const pageAllowed=area==="setup" ? access.permissions.manage_branch : areas.some(a=>a.key===area && hasBranchCapability(access,a.capability));
    const roster=(data?.students??[]).filter(s=>(s.name+" "+(s.phone??"")).toLowerCase().includes(query.toLowerCase()));
    const feeStudents=[...new Map(feeRows.map(p=>[p.studentId,{id:p.studentId,name:p.student?.name??data?.students.find(s=>s.id===p.studentId)?.name??t("Student")}])).values()].filter(s=>s.name.toLowerCase().includes(query.toLowerCase()));
    const modalStudent=modal?.kind==="student"?data?.students.find(s=>s.id===modal.id):undefined;
    const paymentStudent=modal?.kind==="payment"?data?.students.find(s=>s.id===modal.id):undefined;
    return <div className="bp-prototype" data-basic-workspace>
        <a href="#bp-main" className="bp-skip">{t.owned("Skip to content")}</a>
        <div className="bp-app"><aside className="bp-sidebar">
            <Link className="bp-brand" href={root}><Image src="/brand-reference/open-book-leaf.svg" alt="" width={36} height={29}/>Lab Lords</Link>
            <nav aria-label={t.owned("Main navigation")}>{navigation}</nav>
            <div className="bp-sidebar-bottom">
                {access.isOwner && <Link href={orgRoot}><ArrowLeft size={18}/>{t.owned("Back to organization")}</Link>}
                {access.permissions.manage_branch && <Link href={root+"/setup"}><Settings size={18}/>{t.owned("Library setup")}</Link>}
                <Link href={"/account?returnTo="+encodeURIComponent(pathname)}><UserRound size={18}/>{t("Account")}</Link>
                {access.isOwner && <Link className="bp-plan-link" href={orgRoot+"/billing"}><span>{t.owned("Organization plan")}<small>{t.owned("Billing and plans")}</small></span><ChevronRight size={18}/></Link>}
            </div>
        </aside><div className="bp-workspace">
            <header className="bp-topbar"><WorkspaceSwitcher beforeNavigate={()=>navigationRef.current()}/><LanguageControls compact/><Link href={"/account?returnTo="+encodeURIComponent(pathname)} className="bp-profile" aria-label={t("Account")}><span className="bp-avatar">{initials(profileName??"")||<UserRound size={18}/>}</span></Link></header>
            <main id="bp-main" tabIndex={-1} aria-busy={loading || operation.pending}>
                <div className="bp-secondary-mobile">{access.isOwner&&<Link href={orgRoot}>{t("Organization")}</Link>}{access.permissions.manage_branch&&<Link href={root+"/setup"}>{t.owned("Library setup")}</Link>}{access.isOwner&&<Link href={orgRoot+"/billing"}>{t("Billing")}</Link>}</div>
                {access.billingExperience?.accessMode==="READ_ONLY" && <p className="bp-warning" role="status">{t.owned("Records are read-only. Open organization Billing to restore access.")}</p>}
                {notice && <p role="status" className="bp-notice"><Check size={17}/>{notice}</p>}
                {operation.saved && !operation.pending && <section role="alert" className="bp-recovery"><strong>{t.owned("An operation needs confirmation")}</strong><p>{t.error(operation.error || "Check the saved operation before making another change.")}</p><button className="bp-button bp-button-secondary" disabled={blocked} onClick={()=>void recover()}>{t.owned("Check saved operation")}</button>
                    {!["payment","move"].includes(operation.saved.kind) && <button className="bp-text-button" onClick={()=>{if(window.confirm(t.owned("Have you reviewed the current records? Clearing recovery does not undo an operation."))){operation.clear();clean();setModal(null);}}}>{t.owned("I reviewed the records")}</button>}
                </section>}
                {operation.error && !operation.saved && <p className="bp-error" role="alert">{t.error(operation.error)}</p>}
                {!pageAllowed ? <div className="bp-empty"><h1>{t.owned(blockedPageReason)}</h1><Link className="bp-button" href={root}>{t.owned("Back to overview")}</Link></div>
                : loading && !data ? <p role="status" className="bp-empty">{t.owned("Loading workspace")}</p>
                : error ? <div className="bp-empty" role="alert"><p>{t.error(error)}</p><button className="bp-button" onClick={()=>setRevision(v=>v+1)}>{t("Retry")}</button></div>
                : data && <>
                    {area==="" && <><div className="bp-page-heading"><div><p className="bp-eyebrow">{t.owned("A LITTLE MORE ORGANISED, EVERY DAY")}</p><h1>{t.owned("Your library overview")}</h1></div><span className="bp-date">{date(data.summary.today+"T12:00:00",{month:"long",year:"numeric"})}</span></div>
                        <div className="bp-metrics">{can("seatsView")&&<div><span><Armchair size={24}/></span><dl><dt>{t.owned("Available seats")} · {data.shifts.find(s=>s.id===activeShift)?.name}</dt><dd>{availability?.shift===activeShift?availability.available:"—"} <small>/ {availability?.shift===activeShift?availability.total:"—"}</small></dd></dl></div>}{data.summary.activeStudents!==null&&<div><span><Users size={24}/></span><dl><dt>{t("Active students")}</dt><dd>{data.summary.activeStudents}</dd></dl></div>}{data.summary.money&&<div><span><IndianRupee size={24}/></span><dl><dt>{t.owned("Fees collected this month")}</dt><dd>{money(data.summary.money.collectedThisMonth)}</dd></dl></div>}</div>
                        {can("seatsView")&&<BasicSeatMap onAvailability={setAvailability} branchId={access.branchId} shifts={data.shifts} shiftId={activeShift} selected="" sourceIds="" revision={revision} onShift={setShift} onSeat={id=>{setSeat(id);go(root+"/seats");}}/>}
                    </>}
                    {area==="students" && !studentId && <>
                        <div className="bp-page-heading"><div><h1>{t.owned("Your students")}</h1><p>{data.students.length} {t("Students")}</p></div><button className="bp-button bp-button-primary" disabled={disabled||!can("studentsManage")} onClick={()=>setModal({kind:"student"})}><Plus size={18}/>{t("Add student")}</button></div>
                        <div className="bp-list-panel"><label className="bp-search"><Search size={19}/><input aria-label={t.owned("Search students")} placeholder={t.owned("Find a student by name or phone")} value={query} onChange={e=>{setQuery(e.target.value);setLimit(50);}}/></label>
                            {roster.slice(0,limit).map(s=><button className="bp-student-row" key={s.id} onClick={()=>go(root+"/students/"+s.id)}><span className="bp-person"><span className="bp-avatar">{initials(s.name)}</span><span><strong>{s.name}</strong><small>{s.phone??t.owned("No mobile number")} · {t.owned(s.status)}</small></span></span><span className="bp-roster-seat">{activeAllocations(s).map(a=><small key={a.id}>{a.seat.label} · {a.shift.name}</small>)}{!activeAllocations(s).length&&t.owned("Choose a seat")}</span>{can("paymentsView")&&<span className={"bp-fee-status "+(!balance(s.id)?"is-paid":"")}>{balance(s.id)?money(balance(s.id))+" "+t("Due"):t.owned("No outstanding dues")}</span>}<ChevronRight size={18}/></button>)}
                            {!roster.length&&<div className="bp-empty"><Users size={28}/><h2>{t.owned("No students found")}</h2><p>{t.owned("Try another name or add a student.")}</p></div>}
                            {roster.length>limit&&<button className="bp-button" onClick={()=>setLimit(v=>v+50)}>{t("Load more")}</button>}
                        </div>
                    </>}
                    {area==="students"&&studentId&&(currentStudent?<>
                        <button className="bp-back" onClick={()=>go(root+"/students")}><ArrowLeft size={17}/>{t("All students")}</button>
                        <div className="bp-student-heading"><span className="bp-avatar bp-avatar-large">{initials(currentStudent.name)}</span><div><h1>{currentStudent.name}</h1><p>{currentStudent.phone??t.owned("No mobile number")}</p></div><button className="bp-button bp-button-quiet" disabled={disabled||!can("studentsManage")} onClick={()=>setModal({kind:"student",id:currentStudent.id})}>{t.owned("Edit details")}</button></div>
                        <div className="bp-detail-grid">{can("seatsView")&&<section className="bp-detail-card"><Armchair size={23}/><h2>{t("Seats")}</h2>{activeAllocations(currentStudent).map(a=><p key={a.id}>{a.seat.label} · {a.shift.name}{a.multiShift?" · "+a.multiShift.name:""}</p>)}{!activeAllocations(currentStudent).length&&<p>{t.owned("Choose a shift and an available seat.")}</p>}<button className="bp-button bp-button-secondary" disabled={disabled||!can("allocationsManage")} onClick={()=>{chooseStudent(currentStudent.id);go(root+"/seats");}}>{t.owned("Choose or change a seat")}<ArrowRight size={17}/></button></section>}
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
                            {feeStudents.slice(0,limit).map(s=><div className="bp-fee-row" key={s.id}><span className="bp-person"><span className="bp-avatar">{initials(s.name)}</span><strong>{s.name}</strong></span><div className="bp-fee-amount"><strong>{money(balance(s.id))}</strong><small>{t("Due")}</small></div><button className="bp-button bp-button-secondary" disabled={disabled||!can("paymentsRecord")||!balance(s.id)} onClick={()=>setModal({kind:"payment",id:s.id})}>{t.owned("Record payment")}</button></div>)}
                            {!feeStudents.length&&<p className="bp-empty">{t.owned("No student fees are waiting for payment.")}</p>}{feeStudents.length>limit&&<button className="bp-button" onClick={()=>setLimit(v=>v+50)}>{t("Load more")}</button>}
                        </div><FeeDetails fees={feeRows}/><BasicHistory branchId={access.branchId} revision={revision} onReceipt={receipt=>setModal({kind:"receipt",receipt})}/>
                    </>}
                    {area==="setup"&&<BasicSetup key={revision} data={data} disabled={disabled||!can("settingsManage")} onDirty={markDirty} onSave={async(url,method,body)=>{if(!can("settingsManage")||disabled)return;const result=await operation.run(operation.command("setup",url,method,body));if(result)setNotice(t.owned("Library setup saved."));}}/>}
                </>}
            </main>
        </div></div>
        <nav className="bp-mobile-nav" aria-label={t.owned("Main navigation")}>{navigation}</nav>
        {modal?.kind==="student"&&data&&<BasicStudentForm key={modal.id??"new"} student={modalStudent} defaultFee={data.branch.defaultFee??0} admissionFee={data.branch.defaultAdmissionFee??0} pending={operation.pending} locked={!!operation.saved||!can("studentsManage")} error={operation.error} onSave={(input,next)=>void saveStudent(input,next)} onRecover={operation.saved?()=>void recover():undefined} onClose={close} scope={scope} onDirty={markDirty}/>}
        {modal?.kind==="payment"&&<BasicPaymentForm key={modal.id} name={paymentStudent?.name??feeStudents.find(s=>s.id===modal.id)?.name??t("Student")} fees={studentFees(modal.id)} pending={operation.pending} locked={!!operation.saved||!can("paymentsRecord")} error={operation.error} onRecord={(amount,method,ids)=>void recordPayment(amount,method,ids)} onRecover={operation.saved?()=>void recover():undefined} onClose={close} onDirty={markDirty}/>}
        {modal?.kind==="receipt"&&<BasicReceipt branchId={access.branchId} receipt={modal.receipt} onClose={()=>setModal(null)}/>}
        {dirty&&<span className="bp-sr-only" role="status">{t.owned("Unsaved changes")}</span>}
    </div>;
}
function FeeDetails({fees}:{fees:BasicData["payments"]}) {
    const t=useTranslation(),{money,date}=useBasicFormat();
    return <details className="bp-fee-details"><summary>{t.owned("Fee balances and waivers")}</summary>{fees.map(p=><div key={p.id}><strong>{p.student?.name} · {t.owned(p.type==="ADMISSION"?"Admission fee":"Monthly fee")} · {date(p.dueDate)}</strong><p>{t.owned("Billed")}: {money(p.amount)} · {t("Paid")}: {money(p.ledgerBacked?p.collectedAmount:p.status==="PAID"?p.amount:0)} · {t("Waived")}: {money(p.ledgerBacked?p.waivedAmount:p.status==="WAIVED"?p.amount:0)} · {t("Due")}: {money(remainingFee(p))}</p></div>)}</details>;
}
