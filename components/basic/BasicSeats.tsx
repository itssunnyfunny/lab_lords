"use client";
import { useEffect, useState } from "react";
import type { Shift } from "@/app/generated/prisma/browser";
import { useTranslation } from "@/components/settings/LocalizedText";
import { basicRequest } from "./useBasicOperation";
import { seatLabel, type SeatMap } from "./data";
export function BasicSeatMap({ branchId, shifts, shiftId, selected, sourceIds, multiShiftId, revision, onShift, onSeat, onAvailability }: {
    onAvailability?: (summary:{available:number;total:number;shift:string}|null)=>void; branchId: string; shifts: Shift[]; shiftId: string; selected: string; sourceIds: string; multiShiftId?: string; revision: number; onShift: (id: string) => void; onSeat: (id: string) => void;
}) {
    const t = useTranslation(), [map,setMap] = useState<SeatMap | null>(null), [error,setError] = useState(""), [loading,setLoading] = useState(false), [retry,setRetry] = useState(0);
    useEffect(() => {
        if (!shiftId) return;
        const controller = new AbortController();
        queueMicrotask(()=>{if(!controller.signal.aborted){setLoading(true);setMap(null);setError("");onAvailability?.(null);}});
        const params = new URLSearchParams(); if(sourceIds) params.set("excludeAllocationIds",sourceIds); if(multiShiftId) params.set("multiShiftId",multiShiftId); const query = "?"+params;
        basicRequest<SeatMap>("/branches/" + branchId + "/shifts/" + shiftId + "/seat-map" + query, { signal: controller.signal })
            .then(value => { if (!controller.signal.aborted) {setMap(value);onAvailability?.({available:value.availableCount,total:value.totalSeats,shift:shiftId});} }).catch(() => { if(!controller.signal.aborted) setError("Seat availability could not be loaded."); })
            .finally(() => { if(!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [branchId,shiftId,sourceIds,multiShiftId,revision,retry,onAvailability]);
    return <section className="bp-seat-panel" aria-label={t.owned("Seat availability")}>
        <header><h2>{t.owned("Seat availability")}</h2></header>
        <div className="bp-shifts" role="group" aria-label={t.owned("Choose a shift")}>{shifts.filter(s => s.status === "ACTIVE").map(s => <button key={s.id} aria-pressed={s.id === shiftId} onClick={() => onShift(s.id)}><strong>{s.name}</strong><small>{s.startTime ?? "00:00"} – {s.endTime ?? "24:00"}</small></button>)}</div>
        {!shifts.some(s => s.status === "ACTIVE") && <p className="bp-empty">{t.owned("Add a shift in Library setup to view available seats.")}</p>}
        {loading && <p className="bp-empty" role="status">{t("Loading…")}</p>}
        {error && <div className="bp-empty" role="alert"><p>{t.error(error)}</p><button className="bp-button" onClick={() => setRetry(v=>v+1)}>{t("Retry")}</button></div>}
        {!loading && map && <><div className="bp-seat-grid" role="group" aria-label={t("Seats")}>{map.seats.map(seat => <button key={seat.seatId} className={seat.seatId === selected ? "is-selected" : seat.occupied ? "is-occupied" : ""} disabled={seat.occupied}
            aria-pressed={seat.seatId === selected} aria-label={t.owned("Seat") + " " + seatLabel(seat.label) + ", " + t.owned(seat.occupied ? "Occupied" : "Available")} onClick={() => onSeat(seat.seatId)}>{seatLabel(seat.label)}</button>)}</div>
            {!map.seats.length && <p className="bp-empty">{t.owned("No seats configured")}</p>}
            <div className="bp-legend"><span><i className="is-occupied" />{t.owned("Occupied")}</span><span><i />{t.owned("Available")}</span><span><i className="is-selected" />{t.owned("Selected")}</span></div>
            <p className="bp-seat-hint">{t.owned("Available seats")}: {map.availableCount} / {map.totalSeats}<span>{t.owned("Choose a seat to see its details.")}</span></p></>}
    </section>;
}
