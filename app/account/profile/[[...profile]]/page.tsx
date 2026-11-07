export const metadata = { title: { absolute: "Profile & security | Lab Lords" } };
import { Suspense } from "react";
import { ProfileSecurity } from "@/components/account/ProfileSecurity";
export default function ProfilePage() { return <Suspense><ProfileSecurity /></Suspense>; }
