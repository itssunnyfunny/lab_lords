"use client";
import { createContext, useContext } from "react";
export const SidebarCollapsed = createContext(false);
export const useSidebarCollapsed = () => useContext(SidebarCollapsed);
