"use client";
import { usePublicText } from "@/components/landing/PublicLanguageProvider";

import Image from "next/image";
import { publicRich } from "@/lib/public-i18n/rich";
import Link from "next/link";
import { useState } from "react";
import { Armchair, ArrowRight, ChartNoAxesCombined, Check, ChevronDown, CreditCard, House, IndianRupee, Users, UserRound } from "lucide-react";

const shifts = [
  { name: "Morning", time: "8:00 AM – 12:00 PM", occupied: [1, 2, 4, 5, 8, 11, 12, 14, 15, 17, 19, 21, 22, 23, 25, 26, 27, 28, 30] },
  { name: "Afternoon", time: "12:00 PM – 4:00 PM", occupied: [2, 3, 6, 8, 10, 12, 13, 16, 18, 20, 23, 25, 29] },
  { name: "Evening", time: "4:00 PM – 10:00 PM", occupied: [1, 3, 4, 5, 7, 9, 10, 11, 13, 14, 16, 17, 18, 19, 21, 22, 24, 25, 26, 28, 29, 30] },
];

const navigation = [
  { name: "Overview", href: "#library-preview", icon: House },
  { name: "Students", href: "/features#students", icon: Users },
  { name: "Seats & shifts", href: "/features#seats-shifts", icon: Armchair },
  { name: "Payments", href: "/features#fees", icon: CreditCard },
  { name: "Reports", href: "/features#reports", icon: ChartNoAxesCombined },
];

/** A local-only demo; interactions never fetch or modify library records. */
export function BotanicalDashboard() {
  const { t, href: localHref } = usePublicText();
  const [shiftIndex, setShiftIndex] = useState(0);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const shift = shifts[shiftIndex];

  return <section id="library-preview" className="botanical-dashboard" aria-label={t("Interactive library dashboard sample")}>
    <div className="botanical-dashboard-chrome" aria-hidden="true"><i /><i /><i /></div>
    <header className="botanical-dashboard-topbar">
      <div className="botanical-dashboard-brand"><Image src="/brand-reference/open-book-leaf.svg" alt="" width={32} height={22} /><span>Lab Lords</span></div>
      <span className="botanical-dashboard-library">Saraswati Library <ChevronDown size={12} aria-hidden="true" /></span>
      <div className="botanical-dashboard-profile"><span>A</span><div>Amit Kumar<small>{t("Owner")}</small></div><ChevronDown size={11} aria-hidden="true" /></div>
    </header>
    <div className="botanical-dashboard-body">
      <nav className="botanical-dashboard-sidebar" aria-label={t("Explore sample library features")}>
        {navigation.map(({ name, href, icon: Icon }, index) => <Link className={index === 0 ? "is-current" : undefined} href={localHref(href)} key={name}><Icon size={14} strokeWidth={1.7} aria-hidden="true" />{t(name)}</Link>)}
        <div className="botanical-dashboard-sidebar-note"><Image src="/brand-reference/open-book-leaf.svg" alt="" width={32} height={22} />{publicRich(t, "A little more organised.{break}Every single day.", { break: <br /> })}</div>
      </nav>
      <div className="botanical-dashboard-content">
        <div className="botanical-dashboard-heading"><h2>{t("Your library overview")}</h2><span>{t("Sample data")}</span></div>
        <div className="botanical-dashboard-metrics">
          <div><span className="botanical-metric-icon"><UserRound size={23} strokeWidth={1.8} aria-hidden="true" /></span><dl><dt>{t("Active students")}</dt><dd>72</dd></dl></div>
          <div><span className="botanical-metric-icon"><Armchair size={23} strokeWidth={1.8} aria-hidden="true" /></span><dl><dt>{t("Available seats")}</dt><dd>{30 - shift.occupied.length}<span>/30</span></dd></dl></div>
          <div><span className="botanical-metric-icon"><IndianRupee size={22} strokeWidth={1.8} aria-hidden="true" /></span><dl><dt>{t("Fees collected")}</dt><dd>₹18,600</dd></dl></div>
        </div>
        <div className="botanical-seat-panel">
          <div className="botanical-seat-heading"><h3>{t("Seat availability")}</h3><Link href={localHref("/features#seats-shifts")}>{t("View all seats")} <ArrowRight size={11} aria-hidden="true" /></Link></div>
          <div className="botanical-shifts" role="group" aria-label={t("Choose a sample shift")}>{shifts.map((item, index) => <button type="button" key={t(item.name)} aria-pressed={shiftIndex === index} onClick={() => { setShiftIndex(index); setSelectedSeat(null); }}><span>{t(item.name)}</span><small>{item.time}</small></button>)}</div>
          <div className="botanical-seat-grid" role="group" aria-label={t("{shift} sample seats", { shift: t(shift.name) })}>{Array.from({ length: 30 }, (_, index) => {
            const seat = index + 1;
            const occupied = shift.occupied.includes(seat);
            return <button type="button" key={seat} className={occupied ? "is-occupied" : selectedSeat === seat ? "is-selected" : undefined} disabled={occupied} aria-pressed={selectedSeat === seat} aria-label={t("Sample seat {seat}, {state}", { seat, state: t(occupied ? "occupied" : selectedSeat === seat ? "selected" : "available") })} onClick={() => setSelectedSeat(current => current === seat ? null : seat)}>{seat}</button>;
          })}</div>
          <ul className="botanical-seat-legend" aria-label={t("Seat colours")}><li><span className="is-occupied" />{t("Occupied")}</li><li><span />{t("Available")}</li><li><span className="is-selected" />{t("Selected")}</li></ul>
          <p className="botanical-demo-hint" aria-live="polite">{selectedSeat ? t("Seat {seat} selected · {shift} sample", { seat: selectedSeat, shift: t(shift.name).toLowerCase() }) : t("{count} seats available · Try a shift or a seat", { count: 30 - shift.occupied.length })}</p>
        </div>
      </div>
    </div>
    <div className="botanical-payment-note"><span><Check size={13} strokeWidth={3} aria-hidden="true" /></span><div><strong>{t("Payment recorded")}</strong><p>{t("₹1,200 · Student fee")}</p></div><small>{t("Sample event")}</small></div>
  </section>;
}
