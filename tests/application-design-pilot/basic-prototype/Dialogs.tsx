import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { LocalizedPrototype } from "../organization-preview/copy";
import { initials, money, type Receipt, type Student } from "./sample";

type DialogProps = { title: string; eyebrow?: string; onClose: () => void; children: ReactNode };
export function PreviewDialog({ title, eyebrow, onClose, children }: DialogProps) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => {
        ref.current?.showModal();
        ref.current?.querySelector<HTMLInputElement>("[data-initial-focus]")?.focus();
    }, []);
    return <LocalizedPrototype><dialog className="bp-dialog" ref={ref} aria-labelledby={titleId} onCancel={onClose}>
        <header className="bp-dialog-heading">
            <div>{eyebrow && <p className="bp-eyebrow">{eyebrow}</p>}<h2 id={titleId}>{title}</h2></div>
            <button className="bp-icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button>
        </header>
        {children}
    </dialog></LocalizedPrototype>;
}

export type StudentInput = Pick<Student, "name" | "phone" | "monthlyFee">;
export function StudentForm({ student, defaultFee, onSave, onClose }: {
    student?: Student; defaultFee: number; onSave: (input: StudentInput, chooseSeat: boolean) => void; onClose: () => void;
}) {
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const name = String(data.get("name") ?? "").trim();
        if (!name) { event.currentTarget.querySelector<HTMLInputElement>('[name="name"]')?.focus(); return; }
        const next = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
        onSave({ name, phone: String(data.get("phone")), monthlyFee: Number(data.get("fee")) }, next === "seat");
    }
    return <PreviewDialog title={student ? "Edit student" : "Add a student"} eyebrow={student ? undefined : "LET’S GET THEM SETTLED"} onClose={onClose}>
        <p className="bp-dialog-intro">{student ? "Keep their details up to date." : "A few details, then we’ll find them a seat."}</p>
        <form onSubmit={submit}>
            <div className="bp-form-fields">
                <label>Student name<input name="name" defaultValue={student?.name} autoComplete="off" placeholder="e.g. Ananya Sharma" required maxLength={80} data-initial-focus /></label>
                <label>Mobile number<div className="bp-phone-input"><span>+91</span><input name="phone" type="tel" defaultValue={student?.phone} autoComplete="off" inputMode="numeric" placeholder="10-digit number" pattern="[0-9]{10}" title="Enter a 10-digit mobile number" required /></div></label>
                <label>Monthly fee<div className="bp-money-input"><span>₹</span><input name="fee" type="number" min="0" step="1" defaultValue={student?.monthlyFee ?? defaultFee} required /></div><small>You can change this for each student.</small></label>
            </div>
            <footer className="bp-dialog-footer">
                {student ? <button type="button" className="bp-button bp-button-quiet" onClick={onClose}>Cancel</button> : <button className="bp-button bp-button-quiet" type="submit" value="later">Save for later</button>}
                <button className="bp-button bp-button-primary" type="submit" value={student ? "save" : "seat"}>{student ? "Save changes" : "Save & choose seat"}{!student && <ArrowRight size={17} />}</button>
            </footer>
        </form>
    </PreviewDialog>;
}

export function PaymentForm({ student, balance, onRecord, onClose, pending = false }: {
    pending?: boolean;
    student: Student; balance: number; onRecord: (amount: number, method: string) => void; onClose: () => void;
}) {
    const [error, setError] = useState("");
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const amount = Number(data.get("amount"));
        if (!Number.isSafeInteger(amount) || amount <= 0 || amount > balance) { setError("Enter an amount up to the remaining fee."); return; }
        onRecord(amount, String(data.get("method")));
    }
    return <PreviewDialog title="Record a payment" onClose={onClose}>
        <div className="bp-person-summary"><span className="bp-avatar">{initials(student.name)}</span><div><strong>{student.name}</strong><small>October 2026 · student fee</small></div></div>
        <div className="bp-amount-due"><span>Amount left to pay</span><strong>{money(balance)}</strong></div>
        <form onSubmit={submit}>
            <div className="bp-form-fields">
                <label>Amount received<div className="bp-money-input"><span>₹</span><input data-initial-focus name="amount" type="number" min="1" max={balance} step="1" defaultValue={balance} required onChange={() => setError("")} /></div><small>A part payment is fine. We’ll keep track of the rest.</small></label>
                <label>Received by<select name="method" defaultValue="Cash"><option>Cash</option><option>UPI</option><option>Bank transfer</option></select></label>
                {error && <p role="alert" className="bp-error">{error}</p>}
                <p className="bp-subtle">Record money you have already received.</p>
            </div>
            <footer className="bp-dialog-footer"><button className="bp-button bp-button-quiet" type="button" onClick={onClose}>Cancel</button><button className="bp-button bp-button-primary" type="submit" disabled={pending}><Check size={17} />{pending ? "Recording…" : "Record payment"}</button></footer>
        </form>
    </PreviewDialog>;
}

export function ReceiptView({ student, receipt, remaining, justRecorded, onClose, onStudent }: {
    student: Student; receipt: Receipt; remaining: number; justRecorded: boolean; onClose: () => void; onStudent: () => void;
}) {
    return <PreviewDialog title={justRecorded ? "Payment recorded" : "Fee receipt"} onClose={onClose}>
        <div className="bp-receipt">
            <span className="bp-success-mark"><Check size={28} /></span>
            <p className="bp-receipt-amount">{money(receipt.amount)}</p>
            <p>Received from <strong>{student.name}</strong></p>
            <dl><div><dt>For</dt><dd>October 2026 fee</dd></div><div><dt>Paid by</dt><dd>{receipt.method}</dd></div><div><dt>Date</dt><dd>{new Date(`${receipt.date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</dd></div><div><dt>Receipt</dt><dd>{receipt.id}</dd></div></dl>
            <p className="bp-receipt-balance">{remaining > 0 ? <><strong>{money(remaining)}</strong> left to pay this month</> : <><Check size={16} /> This month’s fee is paid</>}</p>
        </div>
        <footer className="bp-dialog-footer"><button className="bp-button bp-button-quiet" onClick={onStudent}>View student</button><button className="bp-button bp-button-primary" onClick={onClose}>Done</button></footer>
    </PreviewDialog>;
}
