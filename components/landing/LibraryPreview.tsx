import { BookOpen, Check, Clock3, Grid2X2, Users } from "lucide-react";

export function SeatExample() {
  return <div className="example-seats">
    <div className="example-panel-heading"><strong>Seats &amp; shifts</strong><span><Clock3 size={13} aria-hidden="true" /> Morning</span></div>
    <div className="example-seat-grid">{Array.from({ length: 12 }, (_, i) => {
      const free = [2, 4, 7, 10].includes(i);
      const label = `${String.fromCharCode(65 + Math.floor(i / 4))}${i % 4 + 1}`;
      return <div key={label} className={`example-seat ${free ? "available" : "assigned"}`}><span>{label}</span><small>{free ? "Free" : "Assigned"}</small></div>;
    })}</div>
    <p className="example-legend"><span><i className="assigned" />8 assigned</span><span><i className="available" />4 available</span></p>
  </div>;
}

export function HeroLibraryPreview() {
  return <div className="example-dashboard hero-dashboard" aria-label="Example library overview">
    <div className="example-topbar"><span><BookOpen size={19} aria-hidden="true" /> My library</span><span className="example-label">Example data</span></div>
    <div className="example-dashboard-body">
      <div className="example-welcome"><div><span>Your library at a glance</span><h2>A little more organised.</h2></div><span className="example-avatar">ML</span></div>
      <div className="example-metrics"><div><Users size={17} aria-hidden="true" /><span>Active students</span><strong>12</strong></div><div><Grid2X2 size={17} aria-hidden="true" /><span>Morning seats</span><strong>8 <small>/ 12</small></strong></div></div>
      <SeatExample />
      <div className="example-fee-summary"><div><span className="example-check"><Check size={16} aria-hidden="true" /></span><div><strong>Aditi Sharma</strong><span>Morning shift · Fee recorded</span></div></div><strong>₹800 <small>Paid</small></strong></div>
    </div>
  </div>;
}
