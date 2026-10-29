import { useEffect, useState, type FormEvent, type SetStateAction } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Armchair, ArrowLeft, ArrowRight, Check, ChevronRight, House, IndianRupee, Plus, Search, Settings, UserRound, Users } from "lucide-react";
import { PaymentForm, ReceiptView, StudentForm, type StudentInput } from "./Dialogs";
import { SeatMap } from "./SeatMap";
import { initials, money, sampleShifts, seatName, shiftTime, type Library, type Receipt, type Shift, type Student } from "./sample";
import "./basic-prototype.css";
import { BranchSelector, PlanContext, PreviewLanguage, billingHref } from "../organization-preview/PreviewNavigation";
import { ORG, names, prices, writable, type Branch } from "../organization-preview/model";
import { identityKey, useFixture, updateBranch, scopedMutation } from "../organization-preview/store";
import { LocalizedPrototype } from "../organization-preview/copy";
import { clearDraft } from "../organization-preview/navigation";

const baseAreas = [
    { key: "overview", label: "Overview", path: "", icon: House },
    { key: "students", label: "Students", path: "/students", icon: Users },
    { key: "seats", label: "Seats", path: "/seats", icon: Armchair },
    { key: "fees", label: "Fees", path: "/fees", icon: IndianRupee },
];
type Modal = { kind: "student"; id?: string } | { kind: "payment"; id: string } | { kind: "receipt"; id: string; justRecorded: boolean } | null;

/** Synthetic preview records only; no production authentication, database or provider access. */
export function BasicPrototype({ branch }: { branch: Branch }) {
    const root = "/branch/" + branch.id;
    const state = useFixture(), owner = state.role === "owner", canWrite = owner && writable(branch), canFees = owner;
    const key = identityKey();
    const areas = baseAreas.filter(area => owner || ["overview", "students"].includes(area.key)).map(area => ({ ...area, path: root + area.path }));
    const pathname = usePathname(), router = useRouter();
    const section = pathname.split("/")[3] || "overview";
    const area = section === "payments" ? "fees" : section;
    const studentId = area === "students" ? pathname.split("/")[4] : undefined;
    const { students, receipts, library, shifts } = branch;
    const setStudents = (next: SetStateAction<Student[]>) => updateBranch(branch.id, b => ({ ...b, students: typeof next === "function" ? next(b.students) : next }), key);
    const setLibrary = (next: Library) => updateBranch(branch.id, b => ({ ...b, library: next, name: next.name }), key);
    const setShifts = (next: Shift[]) => updateBranch(branch.id, b => ({ ...b, shifts: next }), key);
    const [pending, setPending] = useState(false);
    const [shiftId, setShiftId] = useState(sampleShifts[0].id);
    const [selectedStudentId, setSelectedStudentId] = useState("");
    const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
    const [newStudentId, setNewStudentId] = useState<string | null>(null);
    const [notice, setNotice] = useState("");
    const [modal, setModal] = useState<Modal>(null);
    const [query, setQuery] = useState("");
    const [feeFilter, setFeeFilter] = useState("due");
    const selectedStudent = students.find(student => student.id === selectedStudentId);
    const student = students.find(item => item.id === studentId);
    const activeShift = shifts.find(shift => shift.id === shiftId)!;
    const totalPaid = (id: string) => receipts.filter(receipt => receipt.studentId === id).reduce((sum, receipt) => sum + receipt.amount, 0);
    const balance = (item: Student) => Math.max(0, item.monthlyFee - totalPaid(item.id));
    const collected = receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
    const outstanding = students.reduce((sum, item) => sum + balance(item), 0);
    const filtered = students.filter(item => `${item.name} ${item.phone}`.toLowerCase().includes(query.toLowerCase()));
    const occupant = students.find(item => item.shiftId === shiftId && item.seat === selectedSeat);
    const selectionIsCurrent = !!selectedStudent && selectedStudent.seat === selectedSeat && selectedStudent.shiftId === shiftId;
    const selectionBlocked = !!occupant && occupant.id !== selectedStudentId;
    const modalStudent = modal?.kind === "payment" || modal?.kind === "student" ? students.find(item => item.id === modal.id) : undefined;
    const receipt = modal?.kind === "receipt" ? receipts.find(item => item.id === modal.id) : undefined;
    const receiptStudent = receipt ? students.find(item => item.id === receipt.studentId) : undefined;

    useEffect(() => { document.title = `${student?.name ?? baseAreas.find(item => item.key === area)?.label ?? "Library"} · Basic preview`; }, [area, student?.name]);
    function go(path: string) { setQuery(""); setNotice(""); router.push(path); }
    function openStudent(id: string) { go(`${root}/students/${id}`); }
    function saveStudent(input: StudentInput, chooseSeat: boolean) {
        if (!canWrite) return;
        clearDraft();
        if (modal?.kind === "student" && modal.id) {
            setStudents(current => current.map(item => item.id === modal.id ? { ...item, ...input } : item));
            setModal(null); setNotice("Student details saved."); return;
        }
        const created: Student = { ...input, id: crypto.randomUUID(), seat: null, shiftId: null };
        setStudents(current => [created, ...current]); setModal(null);
        if (chooseSeat) {
            setNewStudentId(created.id); setSelectedStudentId(created.id); setSelectedSeat(null);
            go(`${root}/seats`);
        } else { openStudent(created.id); setNotice("Student added. You can choose a seat whenever you’re ready."); }
    }
    function chooseStudent(id: string) {
        setSelectedStudentId(id); setNotice("");
        const current = students.find(item => item.id === id);
        setSelectedSeat(current?.shiftId === shiftId ? current.seat : null);
    }
    function chooseSeat(seat: number, fromOverview = false) {
        if (fromOverview) go(`${root}/seats`);
        setSelectedSeat(seat); setNotice("");
        const current = students.find(item => item.seat === seat && item.shiftId === shiftId);
        if (!selectedStudentId && current) setSelectedStudentId(current.id);
    }
    function assignSeat() {
        if (!canWrite) return;
        clearDraft();
        if (!selectedStudent || selectedSeat === null || selectionBlocked || selectionIsCurrent) return;
        setStudents(current => current.map(item => item.id === selectedStudent.id ? { ...item, seat: selectedSeat, shiftId } : item));
        setNotice(`Seat ${seatName(selectedSeat)} assigned to ${selectedStudent.name}.`);
    }
    async function recordPayment(amount: number, method: string) {
        if (!canWrite || pending || !modalStudent || amount <= 0 || amount > balance(modalStudent)) return;
        const studentId = modalStudent.id;
        const saved: Receipt = { id: branch.id + "-SAMPLE-" + crypto.randomUUID().slice(0, 8), studentId, amount, method, date: "2026-10-28" };
        setPending(true);
        try {
            await scopedMutation(key, branch.id, current => {
                const currentStudent = current.students.find(s => s.id === studentId);
                const remaining = currentStudent ? currentStudent.monthlyFee - current.receipts.filter(r => r.studentId === studentId).reduce((sum,r) => sum+r.amount,0) : 0;
                if (!writable(current) || amount > remaining) throw new Error("Payment cannot be recorded");
                updateBranch(branch.id, b => ({ ...b, receipts: [...b.receipts, saved] }), key);
            });
            clearDraft(); setNewStudentId(null); setModal({ kind: "receipt", id: saved.id, justRecorded: true });
        } finally { setPending(false); }
    }
    function showReceipt(id: string) {
        const latest = receipts.filter(item => item.studentId === id).at(-1);
        if (latest) setModal({ kind: "receipt", id: latest.id, justRecorded: false });
    }
    const seatMap = (overview = false) => <SeatMap shifts={shifts} shiftId={shiftId} seatCount={library.seatCount} students={students} selectedSeat={overview ? null : selectedSeat} onShift={id => { setShiftId(id); setSelectedSeat(null); setNotice(""); }} onSeat={seat => chooseSeat(seat, overview)} onViewAll={overview ? () => go(`${root}/seats`) : undefined} />;
    const navLinks = areas.map(({ key, path, label, icon: Icon }) => <Link key={key} href={path} aria-current={area === key ? "page" : undefined}><Icon size={20} strokeWidth={1.7} /><span>{label}</span></Link>);

    return <LocalizedPrototype><div className="bp-prototype">
        <a href="#bp-main" className="bp-skip">Skip to content</a>
        <div className="bp-app">
            <aside className="bp-sidebar">
                <Link className="bp-brand" href={root}><Image src="/brand-reference/open-book-leaf.svg" alt="" width={36} height={29} />Lab Lords</Link>
                <nav aria-label="Main navigation">{navLinks}</nav>
                <div className="bp-sidebar-bottom">
                    {owner && <Link href={"/org/" + ORG}><ArrowLeft size={18} />Back to organization</Link>}
                    {owner && <Link href={`${root}/setup`} aria-current={area === "setup" ? "page" : undefined}><Settings size={18} />Library setup</Link>}
                    <Link href={`/account?returnTo=${encodeURIComponent(pathname)}`}><UserRound size={18} />Account</Link>
                    {owner ? <Link className="bp-plan-link" href={billingHref(branch.id, pathname)}><span>{names[branch.billed]} <small>Organization plan</small></span><strong>₹{prices[branch.billed]}<small>/ month</small></strong></Link> : <div className="bp-plan-link"><span>{names[branch.billed]}<small>Organization plan</small></span></div>}
                </div>
            </aside>
            <div className="bp-workspace">
                <header className="bp-topbar"><BranchSelector /><PreviewLanguage />{owner && <Link className="op-mobile-setup bp-icon-button" href={`${root}/setup`} aria-label="Library setup"><Settings size={20} /></Link>}<Link href={`/account?returnTo=${encodeURIComponent(pathname)}`} className="bp-profile"><span className="bp-avatar">{owner ? "AK" : "MS"}</span><span>{owner ? "Amit Kumar" : "Meera"}<small>{owner ? "Library owner" : "Staff"}</small></span></Link></header>
                <main id="bp-main" tabIndex={-1}>
                    <PlanContext branch={branch} />
                    {!writable(branch) && <p className="op-readonly" role="status">Access has ended or is awaiting activation. Records are read-only; manage this branch’s plan to recover access.</p>}
                    {area === "overview" && <>
                        <div className="bp-page-heading"><div><p className="bp-eyebrow">A LITTLE MORE ORGANISED, EVERY DAY</p><h1>Your library overview</h1></div><span className="bp-date">October 2026</span></div>
                        <div className="bp-metrics">
                            <div><span><Users size={24} /></span><dl><dt>Active students</dt><dd>{students.length}</dd></dl></div>
                            {owner && <div><span><Armchair size={24} /></span><dl><dt>Available seats</dt><dd>{library.seatCount - students.filter(item => item.shiftId === shiftId && item.seat !== null).length}<small>/{library.seatCount}</small></dd></dl></div>}
                            {canFees && <div><span><IndianRupee size={24} /></span><dl><dt>Fees collected this month</dt><dd>{money(collected)}</dd></dl></div>}
                        </div>
                        {owner && seatMap(true)}
                    </>}
                    {area === "students" && !studentId && <>
                        <div className="bp-page-heading"><div><h1>Your students</h1><p>{students.length} students, a place for each of them.</p></div><button className="bp-button bp-button-primary" disabled={!canWrite} onClick={() => setModal({ kind: "student" })}><Plus size={18} />Add student</button></div>
                        <div className="bp-list-panel"><label className="bp-search"><Search size={19} /><input aria-label="Search students" placeholder="Find a student by name or phone" value={query} onChange={event => setQuery(event.target.value)} /></label>
                            <div className="bp-roster-labels" aria-hidden="true"><span>Student</span><span>Seat & shift</span>{canFees && <span>October fee</span>}<span /></div>
                            {filtered.map(item => <button className="bp-student-row" key={item.id} onClick={() => openStudent(item.id)}>
                                <span className="bp-person"><span className="bp-avatar">{initials(item.name)}</span><span><strong>{item.name}</strong><small>{item.phone}</small></span></span>
                                <span className="bp-roster-seat">{item.seat ? <><strong>Seat {seatName(item.seat)}</strong><small>{shifts.find(shift => shift.id === item.shiftId)?.name}</small></> : <span className="bp-unassigned">Choose a seat</span>}</span>
                                {canFees && <span className={`bp-fee-status ${balance(item) === 0 ? "is-paid" : ""}`}>{balance(item) === 0 ? <><Check size={14} />Paid</> : `${money(balance(item))} due`}</span>}<ChevronRight className="bp-row-chevron" size={18} />
                            </button>)}
                            {!filtered.length && <div className="bp-empty"><Users size={28} /><h2>No students found</h2><p>Try another name or add a student.</p></div>}
                        </div>
                    </>}
                    {area === "students" && studentId && (student ? <>
                        <button className="bp-back" onClick={() => go(`${root}/students`)}><ArrowLeft size={17} />All students</button>
                        <div className="bp-student-heading"><span className="bp-avatar bp-avatar-large">{initials(student.name)}</span><div><h1>{student.name}</h1><p>+91 {student.phone}</p></div><button className="bp-button bp-button-quiet" disabled={!canWrite} onClick={() => setModal({ kind: "student", id: student.id })}>Edit details</button></div>
                        {notice && <p role="status" className="bp-notice"><Check size={17} />{notice}</p>}
                        <div className="bp-detail-grid"><section className="bp-detail-card"><span className="bp-card-icon"><Armchair size={23} /></span><h2>{student.seat ? `Seat ${seatName(student.seat)}` : "Let’s find a seat"}</h2><p>{student.shiftId ? `${shifts.find(item => item.id === student.shiftId)?.name} · ${shiftTime(shifts.find(item => item.id === student.shiftId)!)}` : "Choose a shift and an available seat."}</p><button className="bp-button bp-button-secondary" disabled={!canWrite} onClick={() => { setSelectedStudentId(student.id); setSelectedSeat(student.seat); if (student.shiftId) setShiftId(student.shiftId); go(`${root}/seats`); }}>{student.seat ? "Change seat" : "Choose a seat"}<ArrowRight size={17} /></button></section>
                        {canFees && <section className="bp-detail-card"><span className="bp-card-icon"><IndianRupee size={23} /></span><h2>{balance(student) ? `${money(balance(student))} left to pay` : "All paid for October"}</h2><p>Monthly fee {money(student.monthlyFee)} · Received {money(totalPaid(student.id))}</p><button className="bp-button bp-button-primary" disabled={!canWrite || balance(student) === 0} onClick={() => setModal({ kind: "payment", id: student.id })}>{balance(student) === 0 ? "Fee paid" : "Record payment"}</button></section>}</div>
                        {canFees && <section className="bp-history"><h2>Payments</h2>{receipts.filter(item => item.studentId === student.id).length ? receipts.filter(item => item.studentId === student.id).slice().reverse().map(item => <button key={item.id} onClick={() => setModal({ kind: "receipt", id: item.id, justRecorded: false })}><span><strong>{money(item.amount)}</strong><small>{item.method} · October fee</small></span><span>View receipt <ChevronRight size={16} /></span></button>) : <p>No payments recorded yet.</p>}</section>}
                    </> : <div className="bp-empty"><h1>Student not found in this preview</h1><button className="bp-button" onClick={() => go(`${root}/students`)}>Back to students</button></div>)}
                    {area === "seats" && <>
                        <div className="bp-page-heading"><div><h1>A place to settle in</h1><p>Pick a shift, choose a seat, and make it theirs.</p></div><span className="bp-date">{library.seatCount} seats</span></div>
                        {newStudentId === selectedStudentId && <ol className="bp-steps" aria-label="Student setup progress"><li className="is-done"><Check size={15} />Student added</li><li className={selectionIsCurrent ? "is-done" : "is-current"}>{selectionIsCurrent ? <Check size={15} /> : <span>2</span>}Choose a seat</li><li className={selectionIsCurrent ? "is-current" : ""}><span>3</span>Record a fee</li></ol>}
                        <div className="bp-allocation-layout">{seatMap()}<aside className="bp-assignment" aria-label="Seat assignment">
                            <h2>{selectionIsCurrent ? "All settled in" : "Assign a seat"}</h2>
                            <label>Student<select value={selectedStudentId} onChange={event => chooseStudent(event.target.value)}><option value="">Choose a student</option>{students.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                            {!selectedStudent && <button className="bp-text-button" disabled={!canWrite} onClick={() => setModal({ kind: "student" })}><Plus size={16} />Add a new student</button>}
                            <div className={`bp-chosen-seat ${selectionIsCurrent ? "is-assigned" : ""}`}><Armchair size={32} /><strong>{selectedSeat ? `Seat ${seatName(selectedSeat)}` : "Pick a seat"}</strong><span>{activeShift.name}</span><small>{shiftTime(activeShift)}</small></div>
                            {selectionBlocked ? <p role="status" className="bp-warning">This seat belongs to {occupant?.name}. Choose a free seat for {selectedStudent?.name ?? "your student"}.</p> : selectionIsCurrent ? <p role="status" className="bp-assigned-note"><Check size={16} />Assigned to {selectedStudent?.name}</p> : <p className="bp-subtle">{selectedStudent ? "Select a free seat from the map." : "Choose a student and a free seat to get started."}</p>}
                            {notice && <p className="bp-sr-only" role="status">{notice}</p>}
                            {selectionIsCurrent && selectedStudent ? <><button className="bp-button bp-button-primary" disabled={!canWrite || balance(selectedStudent) === 0} onClick={() => setModal({ kind: "payment", id: selectedStudent.id })}>{balance(selectedStudent) ? "Record fee payment" : "This month is paid"}<ArrowRight size={17} /></button><button className="bp-text-button" onClick={() => openStudent(selectedStudent.id)}>View student</button></> : <button className="bp-button bp-button-primary" disabled={!canWrite || !selectedStudent || !selectedSeat || selectionBlocked} onClick={assignSeat}>Assign seat <Check size={17} /></button>}
                        </aside></div>
                    </>}
                    {area === "fees" && <>
                        <div className="bp-page-heading"><div><h1>Student fees</h1><p>A clear view of what’s paid and what’s left.</p></div><span className="bp-date">October 2026</span></div>
                        <div className="bp-fee-summary"><div><span>Left to collect</span><strong>{money(outstanding)}</strong></div><div><span>Received this month</span><strong>{money(collected)}</strong></div></div>
                        <div className="bp-list-panel"><div className="bp-fee-toolbar"><div className="bp-segment" role="group" aria-label="Show fees"><button aria-pressed={feeFilter === "due"} onClick={() => setFeeFilter("due")}>Needs payment <span>{students.filter(item => balance(item) > 0).length}</span></button><button aria-pressed={feeFilter === "all"} onClick={() => setFeeFilter("all")}>All students</button></div><label className="bp-search"><Search size={18} /><input aria-label="Search fees" placeholder="Find a student" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
                            {filtered.filter(item => feeFilter === "all" || balance(item) > 0).map(item => <div className="bp-fee-row" key={item.id}><button className="bp-person" onClick={() => openStudent(item.id)}><span className="bp-avatar">{initials(item.name)}</span><span><strong>{item.name}</strong><small>{item.seat ? `Seat ${seatName(item.seat)} · ${shifts.find(shift => shift.id === item.shiftId)?.name}` : "Seat not assigned"}</small></span></button><div className="bp-fee-amount"><strong>{balance(item) === 0 ? <span className="bp-paid"><Check size={15} />Paid</span> : money(balance(item))}</strong><small>{balance(item) === 0 ? money(item.monthlyFee) + " received" : totalPaid(item.id) ? `${money(totalPaid(item.id))} paid · ${money(item.monthlyFee)} fee` : "October fee"}</small></div>{balance(item) > 0 ? <button className="bp-button bp-button-secondary" disabled={!canWrite} onClick={() => setModal({ kind: "payment", id: item.id })}>Record payment</button> : <button className="bp-text-button" disabled={!receipts.some(receipt => receipt.studentId === item.id)} onClick={() => showReceipt(item.id)}>View receipt <ChevronRight size={16} /></button>}</div>)}
                            {!filtered.some(item => feeFilter === "all" || balance(item) > 0) && <div className="bp-empty"><Check size={30} /><h2>{query ? "No matching students" : "All caught up"}</h2><p>{query ? "Try another name." : "No student fees are waiting for payment."}</p></div>}
                        </div>
                    </>}
                    {area === "setup" && !canWrite && <div className="bp-empty"><h1>Library setup</h1><p>This branch is read-only. Existing records are preserved.</p></div>}
                    {area === "setup" && canWrite && <Setup key={library.name} library={library} shifts={shifts} minimumSeats={Math.max(1, ...students.map(item => item.seat ?? 0))} onSave={(next, nextShifts) => { if (!canWrite) return; clearDraft(); setLibrary(next); setShifts(nextShifts); setNotice("Library setup saved."); }} notice={notice} />}
                    {![...areas.map(item => item.key), "setup", "account", "subscription"].includes(area) && <div className="bp-empty"><h1>Keep it simple</h1><p>This Basic preview focuses on students, seats and fees.</p><Link className="bp-button bp-button-primary" href={root}>Back to overview</Link></div>}
                </main>
            </div>
        </div>
        <nav className="bp-mobile-nav" aria-label="Main navigation">{navLinks}</nav>
        {modal?.kind === "student" && <StudentForm key={modal.id ?? "new"} student={modalStudent} defaultFee={library.monthlyFee} onSave={saveStudent} onClose={() => { if (!pending) { clearDraft(); setModal(null); } }} />}
        {modal?.kind === "payment" && modalStudent && <PaymentForm pending={pending} student={modalStudent} balance={balance(modalStudent)} onRecord={recordPayment} onClose={() => { if (!pending) { clearDraft(); setModal(null); } }} />}
        {modal?.kind === "receipt" && receipt && receiptStudent && <ReceiptView student={receiptStudent} receipt={receipt} remaining={balance(receiptStudent)} justRecorded={modal.justRecorded} onClose={() => { if (!pending) { clearDraft(); setModal(null); } }} onStudent={() => { setModal(null); openStudent(receiptStudent.id); }} />}
    </div></LocalizedPrototype>;
}

function Setup({ library, shifts, minimumSeats, notice, onSave }: { library: Library; shifts: Shift[]; minimumSeats: number; notice: string; onSave: (library: Library, shifts: Shift[]) => void }) {
    const [error, setError] = useState("");
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); const data = new FormData(event.currentTarget);
        const nextShifts = shifts.map(shift => ({ ...shift, start: String(data.get(`${shift.id}-start`)), end: String(data.get(`${shift.id}-end`)) }));
        if (nextShifts.some(shift => shift.start >= shift.end)) { setError("Each shift needs an end time after its start time."); return; }
        if (nextShifts.some((shift, index) => nextShifts.some((other, otherIndex) => otherIndex !== index && shift.start < other.end && other.start < shift.end))) { setError("Keep these sample shift times separate."); return; }
        setError(""); onSave({ name: String(data.get("name")).trim() || library.name, seatCount: Number(data.get("seats")), monthlyFee: Number(data.get("fee")) }, nextShifts);
    }
    return <LocalizedPrototype><div className="bp-page-heading"><div><h1>Library setup</h1><p>A few essentials. You’re ready to go.</p></div></div><form className="bp-setup-card" onSubmit={submit}><div className="bp-form-fields"><label>Library name<input name="name" defaultValue={library.name} required /></label><div className="bp-form-pair"><label>Number of seats<input type="number" name="seats" defaultValue={library.seatCount} min={minimumSeats} required /><small>Keep all currently assigned seats.</small></label><label>Default monthly fee<div className="bp-money-input"><span>₹</span><input type="number" name="fee" defaultValue={library.monthlyFee} min="0" required /></div><small>Used for new students.</small></label></div><h2>Your shifts</h2>{shifts.map(shift => <fieldset className="bp-setup-shift" key={shift.id}><legend>{shift.name}</legend><label>From<input aria-label={`${shift.name} starts`} type="time" name={`${shift.id}-start`} defaultValue={shift.start} required /></label><label>To<input aria-label={`${shift.name} ends`} type="time" name={`${shift.id}-end`} defaultValue={shift.end} required /></label></fieldset>)}{error && <p className="bp-error" role="alert">{error}</p>}{notice && <p className="bp-notice" role="status"><Check size={17} />{notice}</p>}</div><footer className="bp-dialog-footer"><button className="bp-button bp-button-primary" type="submit">Save setup</button></footer></form></LocalizedPrototype>;
}
