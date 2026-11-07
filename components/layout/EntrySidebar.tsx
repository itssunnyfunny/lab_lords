"use client";
import { Building2 } from "lucide-react";
import { SidebarFrame } from "./SidebarFrame";
import { SidebarItem } from "./SidebarItem";
export function EntrySidebar() {
    return <SidebarFrame homeHref="/org" label="Workspace navigation"><SidebarItem icon={Building2} label="Workspaces" href="/org" isActive density="compact" /></SidebarFrame>;
}
