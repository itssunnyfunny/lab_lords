"use client";

import { useId, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { SeatExample } from "./LibraryPreview";
import copy from "@/lib/marketingCopy.json";

const students = [
  { name: "Aditi Sharma", initials: "AS", seat: "A1", shift: "Morning", fee: "₹800", state: "Paid" },
  { name: "Rohan Patel", initials: "RP", seat: "A2", shift: "Morning", fee: "₹400", state: "Pending" },
  { name: "Meera Singh", initials: "MS", seat: "B2", shift: "Morning", fee: "₹800", state: "Paid" },
] as const;

const tabs = ["Students", "Seats & shifts", "Fees"] as const;

export function LibraryExample() {
  const [selected, setSelected] = useState(0);
  const id = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  return <div className="example-dashboard example-interactive">
    <div className="example-topbar"><span><BookOpen size={19} aria-hidden="true" /> My library</span><span className="example-label">{copy.home.proof.label}</span></div>
    <div role="tablist" aria-label="Example library views" className="example-tabs">
      {tabs.map((label, index) => <button key={label} ref={element => { refs.current[index] = element; }} role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} type="button" onClick={() => setSelected(index)} onKeyDown={event => {
        let next: number;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;
        event.preventDefault(); setSelected(next); refs.current[next]?.focus();
      }}>{label}</button>)}
    </div>
    {tabs.map((label, index) => <div key={label} role="tabpanel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} tabIndex={0} hidden={selected !== index} className="example-tabpanel">
      {index === 0 ? <><h3>Student records, together.</h3><p>Check a student&apos;s seat, shift and fee status.</p><div className="example-student-list">{students.map(student => <div className="example-student" key={student.name}><span className="example-avatar">{student.initials}</span><div><strong>{student.name}</strong><span>Seat {student.seat} · {student.shift}</span></div><span className={`example-status ${student.state === "Pending" ? "pending" : ""}`}>{student.state}</span></div>)}</div></> : index === 1 ? <><h3>A place for every shift.</h3><p>Check availability for the morning shift, 7 am–1 pm.</p><SeatExample /></> : <><h3>Know what&apos;s paid. See what&apos;s pending.</h3><p>Recorded fees stay linked to the right student.</p><div className="example-student-list">{students.map(student => <div className="example-student" key={student.name}><div><strong>{student.name}</strong><span>{student.state === "Paid" ? "Payment recorded" : "Remaining balance"}</span></div><strong className="example-amount">{student.fee}</strong><span className={`example-status ${student.state === "Pending" ? "pending" : ""}`}>{student.state}</span></div>)}</div><p className="example-footnote">Example amounts only. Recording a fee does not charge a student.</p></>}
    </div>)}
  </div>;
}
