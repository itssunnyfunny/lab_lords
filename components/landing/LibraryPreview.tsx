"use client";
import { usePublicText } from "@/components/landing/PublicLanguageProvider";
import { BookOpen, Check, Clock3, Grid2X2, Users } from "lucide-react";

export function SeatExample() {
  const { t } = usePublicText();
  return <div className="example-seats">
    <div className="example-panel-heading"><strong>{t("Seats & shifts")}</strong><span><Clock3 size={13} aria-hidden="true" /> {t("Morning")}</span></div>
    <div className="example-seat-grid">{Array.from({ length: 12 }, (_, i) => {
      const free = [2, 4, 7, 10].includes(i);
      const label = `${String.fromCharCode(65 + Math.floor(i / 4))}${i % 4 + 1}`;
      return <div key={label} className={`example-seat ${free ? "available" : "assigned"}`}><span>{label}</span><small>{t(free ? "Free" : "Assigned")}</small></div>;
    })}</div>
    <p className="example-legend"><span><i className="assigned" />{t("8 assigned")}</span><span><i className="available" />{t("4 available")}</span></p>
  </div>;
}

export function HeroLibraryPreview() {
  const { t } = usePublicText();
  return <div className="example-dashboard hero-dashboard" aria-label={t("Example library overview")}>
    <div className="example-topbar"><span><BookOpen size={19} aria-hidden="true" /> {t("My library")}</span><span className="example-label">{t("Example data")}</span></div>
    <div className="example-dashboard-body">
      <div className="example-welcome"><div><span>{t("Your library at a glance")}</span><h2>{t("A little more organised.")}</h2></div><span className="example-avatar">ML</span></div>
      <div className="example-metrics"><div><Users size={17} aria-hidden="true" /><span>{t("Active students")}</span><strong>12</strong></div><div><Grid2X2 size={17} aria-hidden="true" /><span>{t("Morning seats")}</span><strong>8 <small>/ 12</small></strong></div></div>
      <SeatExample />
      <div className="example-fee-summary"><div><span className="example-check"><Check size={16} aria-hidden="true" /></span><div><strong>Aditi Sharma</strong><span>{t("Morning shift · Fee recorded")}</span></div></div><strong>₹800 <small>{t("Paid")}</small></strong></div>
    </div>
  </div>;
}
