"use client";
import {useEffect} from "react";
import {useParams,useRouter} from "next/navigation";
import {useTranslation} from "@/components/settings/LocalizedText";
/** Basic renders the scoped detail in its shell; full workspaces retain their existing record route. */
export default function StudentDetailReturn(){const {branchId,studentId}=useParams<{branchId:string;studentId:string}>(),router=useRouter(),t=useTranslation();useEffect(()=>{router.replace("/branch/"+encodeURIComponent(branchId)+"/students?studentId="+encodeURIComponent(studentId));},[branchId,studentId,router]);return <p role="status">{t("Loading…")}</p>;}
