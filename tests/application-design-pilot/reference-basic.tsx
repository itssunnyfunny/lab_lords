import React from "react";
import {createRoot} from "react-dom/client";
import {BotanicalDashboard} from "@/components/landing/BotanicalDashboard";
import "@/app/globals.css";
import "@/styles/marketing.css";
import "@/styles/brand-reference.css";
import "@/styles/botanical-home.css";

createRoot(document.getElementById("root")!).render(<div className="marketing-root botanical-home pilot-public-display-font" style={{padding:"64px",minHeight:"100vh"}}><div style={{width:650,maxWidth:"100%",margin:"auto"}}><BotanicalDashboard/></div></div>);
