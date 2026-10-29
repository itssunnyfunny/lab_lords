import { LocalizedPrototype } from "../organization-preview/copy";
import { ArrowRight } from "lucide-react";
import { seatName, shiftTime, type Shift, type Student } from "./sample";

type Props = {
    title?: string; shifts: Shift[]; shiftId: string; seatCount: number; students: Student[];
    selectedSeat?: number | null; onShift: (id: string) => void; onSeat: (seat: number) => void;
    onViewAll?: () => void;
};
export function SeatMap({ title = "Seat availability", shifts, shiftId, seatCount, students, selectedSeat, onShift, onSeat, onViewAll }: Props) {
    const occupants = new Map(students.filter(student => student.shiftId === shiftId && student.seat !== null).map(student => [student.seat, student]));
    const shift = shifts.find(item => item.id === shiftId)!;
    return <LocalizedPrototype><section className="bp-seat-panel" aria-label={title}>
        <header><h2>{title}</h2>{onViewAll && <button className="bp-text-button" onClick={onViewAll}>View all seats <ArrowRight size={16} /></button>}</header>
        <div className="bp-shifts" role="group" aria-label="Choose a shift">{shifts.map(item => <button key={item.id} aria-pressed={item.id === shiftId} onClick={() => onShift(item.id)}><strong>{item.name}</strong><small>{shiftTime(item)}</small></button>)}</div>
        <div className="bp-seat-grid" role="group" aria-label={`${shift.name} seats`}>{Array.from({ length: seatCount }, (_, i) => {
            const seat = i + 1, occupant = occupants.get(seat);
            return <button key={seat} className={selectedSeat === seat ? "is-selected" : occupant ? "is-occupied" : ""} aria-pressed={selectedSeat === seat} aria-label={`Seat ${seatName(seat)}, ${occupant ? `occupied by ${occupant.name}` : "available"}`} onClick={() => onSeat(seat)}>{seatName(seat)}</button>;
        })}</div>
        <div className="bp-legend"><span><i className="is-occupied" />Occupied</span><span><i />Available</span><span><i className="is-selected" />Selected</span></div>
        <p className="bp-seat-hint">{seatCount - occupants.size} seats available in {shift.name.toLowerCase()}<span>Choose a seat to see its details.</span></p>
    </section></LocalizedPrototype>;
}
